import { ConvexError, v } from "convex/values";
import { HOUR, MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { components, internal } from "./_generated/api";
import { mutation } from "./_generated/server";
import { validarContacto } from "./lib/contacto";

/**
 * Formulario «Contáctanos» del catálogo público.
 *
 * `enviar` es la ÚNICA función pública de escritura (no pide sesión). Está acotada a propósito:
 * solo inserta en `solicitudes`, no devuelve datos y no hay ninguna query pública sobre esa tabla.
 * Las solicitudes se leen y gestionan desde el panel (convex/solicitudes.ts, con requerirAdmin).
 */

const limites = new RateLimiter(components.rateLimiter, {
  // por correo y por teléfono: evita que una misma persona (o un robot) mande muchas seguidas
  porRemitente: { kind: "fixed window", rate: 3, period: 10 * MINUTE },
  // tope total, para que nadie pueda llenar la tabla
  global: { kind: "token bucket", rate: 30, period: HOUR, capacity: 30 },
});

const MSJ_LIMITE = "Recibimos varias solicitudes seguidas. Inténtalo de nuevo en unos minutos.";

export const enviar = mutation({
  args: {
    nombre: v.string(),
    telefono: v.string(),
    correo: v.string(),
    mensaje: v.string(),
    /** Campo oculto del formulario: una persona lo deja vacío; los robots lo llenan. */
    web: v.string(),
  },
  handler: async (ctx, { web, ...entrada }) => {
    // al robot se le responde como si hubiera funcionado, pero no se guarda nada
    if (web.trim()) return { ok: true as const };

    const { datos, errores } = validarContacto(entrada);
    const primero = Object.values(errores)[0];
    if (primero) throw new ConvexError({ campos: errores, mensaje: primero });

    for (const key of [`correo:${datos.correo}`, `tel:${datos.telefono.replace(/\D/g, "")}`]) {
      if (!(await limites.limit(ctx, "porRemitente", { key })).ok) throw new ConvexError(MSJ_LIMITE);
    }
    if (!(await limites.limit(ctx, "global")).ok) throw new ConvexError(MSJ_LIMITE);

    const id = await ctx.db.insert("solicitudes", { ...datos, estado: "nueva" });
    await ctx.scheduler.runAfter(0, internal.notificaciones.nuevaSolicitud, { id });
    return { ok: true as const };
  },
});
