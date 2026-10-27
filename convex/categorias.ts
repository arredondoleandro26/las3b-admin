import { ConvexError, v } from "convex/values";
import { mutation } from "./_generated/server";
import { requerirAdmin } from "./lib/acceso";
import { activosDeCategoria, archivarProductos, categoriasActivas, renumerar, restaurarProductos, revivirCategoria } from "./lib/archivo";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

async function categoriaActiva(ctx: MutationCtx, id: Id<"categorias">) {
  const c = await ctx.db.get(id);
  if (!c || c.eliminada) throw new ConvexError("La categoría ya no existe.");
  return c;
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
    const todas = await categoriasActivas(ctx);
    const id = await ctx.db.insert("categorias", { nombre: limpio, icono: icono.trim() || "🛍️", orden: todas.length });
    if (posicion !== undefined && posicion >= 0 && posicion < todas.length) {
      todas.splice(posicion, 0, (await ctx.db.get(id))!);
      await renumerar(ctx, todas);
    }
    return id;
  },
});

export const actualizar = mutation({
  args: { id: v.id("categorias"), nombre: v.optional(v.string()), icono: v.optional(v.string()) },
  handler: async (ctx, { id, nombre, icono }) => {
    await requerirAdmin(ctx);
    await categoriaActiva(ctx, id);
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
    const todas = await categoriasActivas(ctx);
    const i = todas.findIndex((c) => c._id === id);
    const j = i + direccion;
    if (i < 0 || j < 0 || j >= todas.length) return;
    [todas[i], todas[j]] = [todas[j], todas[i]];
    await renumerar(ctx, todas);
  },
});

/**
 * Elimina la categoría: deja de verse y sus productos pasan a Archivados (con el nombre de la
 * categoría). Devuelve los productos archivados, para poder deshacerlo con `restaurar`.
 */
export const eliminar = mutation({
  args: { id: v.id("categorias") },
  handler: async (ctx, { id }) => {
    await requerirAdmin(ctx);
    const cat = await categoriaActiva(ctx, id);
    const productos = (await activosDeCategoria(ctx, id)).map((p) => p._id);
    await archivarProductos(ctx, productos, cat.nombre);
    await ctx.db.patch(id, { eliminada: Date.now() });
    await renumerar(ctx, await categoriasActivas(ctx));
    return productos;
  },
});

/** Deshace `eliminar`: la categoría vuelve a su lugar junto con los productos indicados. */
export const restaurar = mutation({
  args: { id: v.id("categorias"), productos: v.array(v.id("productos")) },
  handler: async (ctx, { id, productos }) => {
    await requerirAdmin(ctx);
    const cat = await ctx.db.get(id);
    if (!cat) throw new ConvexError("La categoría se eliminó para siempre y ya no se puede recuperar.");
    await revivirCategoria(ctx, cat);
    await restaurarProductos(ctx, productos);
  },
});
