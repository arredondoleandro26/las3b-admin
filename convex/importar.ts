import { ConvexError, v } from "convex/values";
import { mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requerirAdmin } from "./lib/acceso";
import { ajustesCampos, estadoValidator } from "./lib/validadores";
import { obtenerOCrearAjustes } from "./ajustes";

/**
 * Importación del catálogo HTML antiguo. El navegador (panel admin) parsea el archivo,
 * sube las imágenes al storage y llama a estas mutaciones por lotes.
 */

/** Borra categorías, productos e imágenes. Se usa cuando el usuario elige "reemplazar todo". */
export const vaciar = mutation({
  args: {},
  handler: async (ctx) => {
    await requerirAdmin(ctx);
    const productos = await ctx.db.query("productos").collect();
    for (const p of productos) {
      for (const img of p.imagenes) await ctx.storage.delete(img.storageId).catch(() => {});
      await ctx.db.delete(p._id);
    }
    const categorias = await ctx.db.query("categorias").collect();
    for (const c of categorias) await ctx.db.delete(c._id);
    return { productos: productos.length, categorias: categorias.length };
  },
});

/** Crea las categorías en orden y devuelve el mapa idAntiguo -> idNuevo. */
export const categorias = mutation({
  args: { items: v.array(v.object({ idAntiguo: v.string(), nombre: v.string(), icono: v.string() })) },
  handler: async (ctx, { items }) => {
    await requerirAdmin(ctx);
    const existentes = await ctx.db.query("categorias").collect();
    let orden = existentes.reduce((m, c) => Math.max(m, c.orden), -1) + 1;
    const mapa: Record<string, Id<"categorias">> = {};
    for (const it of items) {
      mapa[it.idAntiguo] = await ctx.db.insert("categorias", {
        nombre: it.nombre.trim() || "SIN NOMBRE",
        icono: it.icono.trim() || "🛍️",
        orden: orden++,
      });
    }
    return mapa;
  },
});

/** Inserta un lote de productos (máx. 100 por llamada para no exceder límites de la mutación). */
export const productos = mutation({
  args: {
    items: v.array(
      v.object({
        catId: v.id("categorias"),
        nombre: v.string(),
        precio: v.number(),
        estado: estadoValidator,
        oferta: v.optional(v.boolean()),
        antes: v.optional(v.number()),
        orden: v.number(),
        imagenes: v.array(v.id("_storage")),
      }),
    ),
  },
  handler: async (ctx, { items }) => {
    await requerirAdmin(ctx);
    if (items.length > 100) throw new ConvexError("Lote demasiado grande (máx. 100).");
    let insertados = 0;
    for (const it of items) {
      const imagenes = [];
      for (const s of it.imagenes) {
        const url = await ctx.storage.getUrl(s);
        if (url) imagenes.push({ storageId: s, url });
      }
      await ctx.db.insert("productos", {
        catId: it.catId,
        nombre: it.nombre.trim() || "Sin nombre",
        precio: Math.max(0, Math.round(it.precio)),
        estado: it.estado,
        oferta: it.oferta || undefined,
        antes: it.antes || undefined,
        orden: it.orden,
        imagenes,
      });
      insertados++;
    }
    return insertados;
  },
});

/** Ajustes del negocio + banner (opcional) en un solo paso. */
export const ajustes = mutation({
  args: { ...ajustesCampos, bannerId: v.optional(v.id("_storage")) },
  handler: async (ctx, { bannerId, ...campos }) => {
    await requerirAdmin(ctx);
    const a = await obtenerOCrearAjustes(ctx);
    const patch: Record<string, unknown> = { ...campos, whatsapp: campos.whatsapp.replace(/\D/g, "") };
    if (bannerId) {
      if (a.bannerId && a.bannerId !== bannerId) await ctx.storage.delete(a.bannerId).catch(() => {});
      const url = await ctx.storage.getUrl(bannerId);
      if (url) {
        patch.bannerId = bannerId;
        patch.bannerUrl = url;
      }
    }
    await ctx.db.patch(a._id, patch);
  },
});
