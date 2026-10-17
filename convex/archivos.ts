import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requerirAdmin } from "./lib/acceso";

/**
 * Paso 1 de una subida: el navegador pide una URL temporal y hace POST del archivo ahí.
 * Paso 2: con el storageId devuelto llama a productos.agregarImagen / ajustes.cambiarBanner / importar.*
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
