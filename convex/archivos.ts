import { v } from "convex/values";
import { internalMutation, mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requerirAdmin } from "./lib/acceso";

/**
 * Paso 1 de una subida: el navegador pide una URL temporal y hace POST del archivo ahí.
 * Paso 2: con el storageId devuelto llama a productos.fijarImagenes / ajustes.cambiarBanner / importar.*
 */
export const generarUrlSubida = mutation({
  args: {},
  handler: async (ctx) => {
    await requerirAdmin(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/** Borra un archivo que quedó huérfano (p. ej. se subió y luego se canceló el formulario). */
export const eliminar = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    await requerirAdmin(ctx);
    await ctx.storage.delete(storageId).catch(() => {});
  },
});

/** Un archivo sin usar se borra recién pasado este tiempo: mientras tanto, «Deshacer» lo puede recuperar. */
const GRACIA_MS = 24 * 60 * 60 * 1000;

/**
 * Borra los archivos que ya no usa ningún producto (tampoco los archivados) ni el banner. Lo corre el
 * cron diario de convex/crons.ts. Las imágenes que se quitan o reemplazan no se borran en el momento
 * para que se puedan recuperar con «Deshacer».
 */
export const limpiarHuerfanos = internalMutation({
  args: {},
  handler: async (ctx) => {
    const usados = new Set<Id<"_storage">>();
    for (const p of await ctx.db.query("productos").collect()) for (const i of p.imagenes) usados.add(i.storageId);
    const a = await ctx.db.query("ajustes").first();
    if (a?.bannerId) usados.add(a.bannerId);
    const limite = Date.now() - GRACIA_MS;
    let borrados = 0;
    for (const f of await ctx.db.system.query("_storage").collect()) {
      if (f._creationTime > limite || usados.has(f._id)) continue;
      await ctx.storage.delete(f._id);
      borrados++;
    }
    return borrados;
  },
});
