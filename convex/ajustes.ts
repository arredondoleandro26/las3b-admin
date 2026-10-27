import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { requerirAdmin } from "./lib/acceso";
import { AJUSTES_POR_DEFECTO, ajustesCampos, contactoValidator } from "./lib/validadores";
import type { MutationCtx } from "./_generated/server";

/** Devuelve la fila de ajustes, creándola con valores por defecto si no existe. */
export async function obtenerOCrearAjustes(ctx: MutationCtx) {
  const existente = await ctx.db.query("ajustes").first();
  if (existente) return existente;
  const id = await ctx.db.insert("ajustes", { ...AJUSTES_POR_DEFECTO });
  return (await ctx.db.get(id))!;
}

export const obtener = query({
  args: {},
  handler: async (ctx) => {
    await requerirAdmin(ctx);
    return (await ctx.db.query("ajustes").first()) ?? null;
  },
});

export const actualizar = mutation({
  args: ajustesCampos,
  handler: async (ctx, args) => {
    await requerirAdmin(ctx);
    const a = await obtenerOCrearAjustes(ctx);
    const whatsapp = args.whatsapp.replace(/\D/g, "");
    await ctx.db.patch(a._id, { ...args, whatsapp });
  },
});

/** El banner anterior no se borra (se puede deshacer); lo limpia el cron `limpiarHuerfanos`. */
export const cambiarBanner = mutation({
  args: { storageId: v.union(v.id("_storage"), v.null()) },
  handler: async (ctx, { storageId }) => {
    await requerirAdmin(ctx);
    const a = await obtenerOCrearAjustes(ctx);
    if (!storageId) {
      await ctx.db.patch(a._id, { bannerId: undefined, bannerUrl: undefined });
      return;
    }
    const url = await ctx.storage.getUrl(storageId);
    if (!url) throw new Error("El archivo del banner no existe.");
    await ctx.db.patch(a._id, { bannerId: storageId, bannerUrl: url });
  },
});

/**
 * Cambia el título o los datos de contacto desde la terminal (sin sesión), p. ej.:
 *   npx convex run --prod ajustes:actualizarInterno '{"titulo":"Catálogo de productos"}'
 */
export const actualizarInterno = internalMutation({
  args: { titulo: v.optional(v.string()), contacto: v.optional(contactoValidator) },
  handler: async (ctx, cambios) => {
    const a = await obtenerOCrearAjustes(ctx);
    await ctx.db.patch(a._id, cambios);
  },
});
