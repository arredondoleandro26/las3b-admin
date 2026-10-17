import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { requerirAdmin } from "./lib/acceso";
import { estadoValidator } from "./lib/validadores";

async function productosDeCategoria(ctx: MutationCtx, catId: Id<"categorias">) {
  return ctx.db.query("productos").withIndex("por_categoria", (q) => q.eq("catId", catId)).collect();
}

async function siguienteOrden(ctx: MutationCtx, catId: Id<"categorias">) {
  const lista = await productosDeCategoria(ctx, catId);
  return lista.reduce((m, p) => Math.max(m, p.orden), -1) + 1;
}

async function urlDe(ctx: MutationCtx, storageId: Id<"_storage">) {
  const url = await ctx.storage.getUrl(storageId);
  if (!url) throw new ConvexError("La imagen no existe en el almacenamiento.");
  return { storageId, url };
}

/** Vista completa para el panel: incluye descontinuados. */
export const listarTodo = query({
  args: {},
  handler: async (ctx) => {
    await requerirAdmin(ctx);
    const categorias = await ctx.db.query("categorias").withIndex("por_orden").collect();
    const productos = (await ctx.db.query("productos").collect()).sort((a, b) => a.orden - b.orden);
    const ajustes = (await ctx.db.query("ajustes").first()) ?? null;
    return { ajustes, categorias, productos };
  },
});

export const crear = mutation({
  args: {
    catId: v.id("categorias"),
    nombre: v.string(),
    precio: v.number(),
    imagenes: v.array(v.id("_storage")),
  },
  handler: async (ctx, { catId, nombre, precio, imagenes }) => {
    await requerirAdmin(ctx);
    if (!(await ctx.db.get(catId))) throw new ConvexError("La categoría no existe.");
    const limpio = nombre.trim();
    if (!limpio) throw new ConvexError("Escribe el nombre del producto.");
    if (!(precio >= 0)) throw new ConvexError("El precio debe ser un número mayor o igual a 0.");
    const imgs = [];
    for (const s of imagenes) imgs.push(await urlDe(ctx, s));
    return await ctx.db.insert("productos", {
      catId,
      nombre: limpio,
      precio: Math.round(precio),
      estado: "disponible",
      orden: await siguienteOrden(ctx, catId),
      imagenes: imgs,
    });
  },
});

export const actualizar = mutation({
  args: {
    id: v.id("productos"),
    nombre: v.optional(v.string()),
    precio: v.optional(v.number()),
    estado: v.optional(estadoValidator),
    oferta: v.optional(v.boolean()),
    /** null quita el precio anterior */
    antes: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (ctx, { id, ...cambios }) => {
    await requerirAdmin(ctx);
    const p = await ctx.db.get(id);
    if (!p) throw new ConvexError("El producto ya no existe.");
    const patch: Partial<typeof p> = {};
    if (cambios.nombre !== undefined) {
      if (!cambios.nombre.trim()) throw new ConvexError("El nombre no puede quedar vacío.");
      patch.nombre = cambios.nombre.trim();
    }
    if (cambios.precio !== undefined) patch.precio = Math.max(0, Math.round(cambios.precio));
    if (cambios.estado !== undefined) patch.estado = cambios.estado;
    if (cambios.oferta !== undefined) patch.oferta = cambios.oferta;
    if (cambios.antes !== undefined) {
      patch.antes = cambios.antes === null ? undefined : Math.max(0, Math.round(cambios.antes));
    }
    await ctx.db.patch(id, patch);
  },
});

export const eliminar = mutation({
  args: { id: v.id("productos") },
  handler: async (ctx, { id }) => {
    await requerirAdmin(ctx);
    const p = await ctx.db.get(id);
    if (!p) return;
    for (const img of p.imagenes) await ctx.storage.delete(img.storageId).catch(() => {});
    await ctx.db.delete(id);
  },
});

/** Mueve uno o varios productos a otra categoría, al final de ella y manteniendo su orden relativo. */
export const moverCategoria = mutation({
  args: { ids: v.array(v.id("productos")), catId: v.id("categorias") },
  handler: async (ctx, { ids, catId }) => {
    await requerirAdmin(ctx);
    if (!(await ctx.db.get(catId))) throw new ConvexError("La categoría de destino no existe.");
    let orden = await siguienteOrden(ctx, catId);
    const docs = [];
    for (const id of ids) {
      const p = await ctx.db.get(id);
      if (p) docs.push(p);
    }
    docs.sort((a, b) => a.orden - b.orden);
    let movidos = 0;
    for (const p of docs) {
      if (p.catId === catId) continue;
      await ctx.db.patch(p._id, { catId, orden: orden++ });
      movidos++;
    }
    return movidos;
  },
});

/**
 * Reordena los productos de una categoría. `ids` trae los productos de esa categoría en el orden
 * deseado; los que falten quedan al final conservando su orden previo.
 */
export const reordenar = mutation({
  args: { catId: v.id("categorias"), ids: v.array(v.id("productos")) },
  handler: async (ctx, { catId, ids }) => {
    await requerirAdmin(ctx);
    const actuales = (await productosDeCategoria(ctx, catId)).sort((a, b) => a.orden - b.orden);
    const enCat = new Set(actuales.map((p) => p._id));
    const finales: Id<"productos">[] = ids.filter((id) => enCat.has(id));
    for (const p of actuales) if (!finales.includes(p._id)) finales.push(p._id);
    await Promise.all(finales.map((id, i) => ctx.db.patch(id, { orden: i })));
  },
});

export const agregarImagen = mutation({
  args: { id: v.id("productos"), storageId: v.id("_storage") },
  handler: async (ctx, { id, storageId }) => {
    await requerirAdmin(ctx);
    const p = await ctx.db.get(id);
    if (!p) throw new ConvexError("El producto ya no existe.");
    await ctx.db.patch(id, { imagenes: [...p.imagenes, await urlDe(ctx, storageId)] });
  },
});

export const reemplazarImagen = mutation({
  args: { id: v.id("productos"), indice: v.number(), storageId: v.id("_storage") },
  handler: async (ctx, { id, indice, storageId }) => {
    await requerirAdmin(ctx);
    const p = await ctx.db.get(id);
    if (!p) throw new ConvexError("El producto ya no existe.");
    const imgs = [...p.imagenes];
    const nueva = await urlDe(ctx, storageId);
    if (indice < 0 || indice >= imgs.length) imgs.push(nueva);
    else {
      await ctx.storage.delete(imgs[indice].storageId).catch(() => {});
      imgs[indice] = nueva;
    }
    await ctx.db.patch(id, { imagenes: imgs });
  },
});

export const quitarImagen = mutation({
  args: { id: v.id("productos"), indice: v.number() },
  handler: async (ctx, { id, indice }) => {
    await requerirAdmin(ctx);
    const p = await ctx.db.get(id);
    if (!p) throw new ConvexError("El producto ya no existe.");
    const imgs = [...p.imagenes];
    const [quitada] = imgs.splice(indice, 1);
    if (quitada) await ctx.storage.delete(quitada.storageId).catch(() => {});
    await ctx.db.patch(id, { imagenes: imgs });
  },
});
