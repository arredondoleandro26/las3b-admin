import { ConvexError, v } from "convex/values";
import { mutation } from "./_generated/server";
import { requerirAdmin } from "./lib/acceso";
import type { MutationCtx } from "./_generated/server";

async function todasOrdenadas(ctx: MutationCtx) {
  return ctx.db.query("categorias").withIndex("por_orden").collect();
}

/** Reescribe el campo orden como 0..n-1 siguiendo el orden de ids recibido. */
async function reescribirOrden(ctx: MutationCtx, ids: Array<import("./_generated/dataModel").Id<"categorias">>) {
  await Promise.all(ids.map((id, i) => ctx.db.patch(id, { orden: i })));
}

export const crear = mutation({
  args: {
    nombre: v.string(),
    icono: v.string(),
    /** Posición en la lista (0 = primera). Si se omite va al final. */
    posicion: v.optional(v.number()),
  },
  handler: async (ctx, { nombre, icono, posicion }) => {
    await requerirAdmin(ctx);
    const limpio = nombre.trim();
    if (!limpio) throw new ConvexError("La categoría necesita un nombre.");
    const todas = await todasOrdenadas(ctx);
    const id = await ctx.db.insert("categorias", { nombre: limpio, icono: icono.trim() || "🛍️", orden: todas.length });
    if (posicion !== undefined && posicion >= 0 && posicion < todas.length) {
      const ids = todas.map((c) => c._id);
      ids.splice(posicion, 0, id);
      await reescribirOrden(ctx, ids);
    }
    return id;
  },
});

export const actualizar = mutation({
  args: { id: v.id("categorias"), nombre: v.optional(v.string()), icono: v.optional(v.string()) },
  handler: async (ctx, { id, nombre, icono }) => {
    await requerirAdmin(ctx);
    const cambios: { nombre?: string; icono?: string } = {};
    if (nombre !== undefined) {
      if (!nombre.trim()) throw new ConvexError("El nombre no puede quedar vacío.");
      cambios.nombre = nombre.trim();
    }
    if (icono !== undefined) cambios.icono = icono.trim() || "🛍️";
    await ctx.db.patch(id, cambios);
  },
});

/** Sube (-1) o baja (+1) una categoría un lugar. */
export const desplazar = mutation({
  args: { id: v.id("categorias"), direccion: v.union(v.literal(-1), v.literal(1)) },
  handler: async (ctx, { id, direccion }) => {
    await requerirAdmin(ctx);
    const ids = (await todasOrdenadas(ctx)).map((c) => c._id);
    const i = ids.indexOf(id);
    const j = i + direccion;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await reescribirOrden(ctx, ids);
  },
});

/** Elimina la categoría y TODOS sus productos (con sus imágenes en storage). */
export const eliminar = mutation({
  args: { id: v.id("categorias") },
  handler: async (ctx, { id }) => {
    await requerirAdmin(ctx);
    const productos = await ctx.db.query("productos").withIndex("por_categoria", (q) => q.eq("catId", id)).collect();
    for (const p of productos) {
      for (const img of p.imagenes) await ctx.storage.delete(img.storageId).catch(() => {});
      await ctx.db.delete(p._id);
    }
    await ctx.db.delete(id);
    const restantes = (await todasOrdenadas(ctx)).map((c) => c._id);
    await reescribirOrden(ctx, restantes);
  },
});
