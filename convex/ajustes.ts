import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requerirAdmin } from "./lib/acceso";
import { AJUSTES_POR_DEFECTO, ajustesCampos } from "./lib/validadores";
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

export const cambiarBanner = mutation({
  args: { storageId: v.union(v.id("_storage"), v.null()) },
  handler: async (ctx, { storageId }) => {
    await requerirAdmin(ctx);
    const a = await obtenerOCrearAjustes(ctx);
    if (a.bannerId && a.bannerId !== storageId) {
      await ctx.storage.delete(a.bannerId).catch(() => {});
    }
    if (!storageId) {
      await ctx.db.patch(a._id, { bannerId: undefined, bannerUrl: undefined });
      return;
    }
    const url = await ctx.storage.getUrl(storageId);
    if (!url) throw new Error("El archivo del banner no existe.");
    await ctx.db.patch(a._id, { bannerId: storageId, bannerUrl: url });
  },
});
