import { v } from "convex/values";
import { internalAction, internalQuery } from "./_generated/server";

/**
 * Aviso al negocio cuando llega una solicitud de contacto. Hoy no envía nada: las solicitudes se ven
 * en la pestaña «📨 Solicitudes» del panel.
 *
 * Para avisar por correo con Resend (cuando el cliente tenga cuenta y dominio verificado):
 *   1. npm install @convex-dev/resend   y agregar `app.use(resend)` en convex/convex.config.ts
 *   2. npx convex env set RESEND_API_KEY re_...   (y RESEND_FROM, p. ej. "Las 3B <avisos@dominio.cl>")
 *   3. Completar `nuevaSolicitud` con el envío (ver comentario abajo). La mutación `contacto.enviar`
 *      ya la programa en cada solicitud; no hay que tocar el formulario, la mutación ni la tabla.
 */

/** Lo necesario para armar el aviso: la solicitud y a qué correo mandarlo (el de ⚙️ Ajustes › contacto). */
export const datosAviso = internalQuery({
  args: { id: v.id("solicitudes") },
  handler: async (ctx, { id }) => {
    const solicitud = await ctx.db.get(id);
    const ajustes = await ctx.db.query("ajustes").first();
    return solicitud ? { solicitud, destino: ajustes?.contacto?.correo ?? "", negocio: ajustes?.nombre ?? "" } : null;
  },
});

export const nuevaSolicitud = internalAction({
  args: { id: v.id("solicitudes") },
  handler: async (_ctx, _args) => {
    // Integración pendiente con Resend. Esqueleto:
    //   if (!process.env.RESEND_API_KEY) return;
    //   const d = await ctx.runQuery(internal.notificaciones.datosAviso, args);
    //   if (!d?.destino) return;
    //   await resend.sendEmail(ctx, { from: process.env.RESEND_FROM!, to: d.destino, replyTo: d.solicitud.correo,
    //     subject: `Solicitud de contacto – ${d.solicitud.nombre}`, text: `${d.solicitud.mensaje}\n\n${d.solicitud.telefono}` });
  },
});
