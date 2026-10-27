import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { requerirAdmin } from "./lib/acceso";
import { estadoValidator } from "./lib/validadores";
import { activosDeCategoria, archivarProductos, categoriasActivas, purgarArchivados, renumerar, restaurarProductos } from "./lib/archivo";

async function siguienteOrden(ctx: MutationCtx, catId: Id<"categorias">) {
  const lista = await activosDeCategoria(ctx, catId);
  return lista.reduce((m, p) => Math.max(m, p.orden), -1) + 1;
}

async function categoriaActiva(ctx: MutationCtx, catId: Id<"categorias">) {
  const c = await ctx.db.get(catId);
  if (!c || c.eliminada) throw new ConvexError("La categoría no existe.");
  return c;
}

async function urlDe(ctx: MutationCtx, storageId: Id<"_storage">) {
  const url = await ctx.storage.getUrl(storageId);
  if (!url) throw new ConvexError("La imagen no existe en el almacenamiento.");
  return { storageId, url };
}

/** Vista completa para el panel: incluye descontinuados, pero no lo archivado. */
export const listarTodo = query({
  args: {},
  handler: async (ctx) => {
    await requerirAdmin(ctx);
    const categorias = await categoriasActivas(ctx);
    const productos = (await ctx.db.query("productos").collect()).filter((p) => !p.archivado).sort((a, b) => a.orden - b.orden);
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
    await categoriaActiva(ctx, catId);
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
    if (!p || p.archivado) throw new ConvexError("El producto ya no existe.");
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

/* ---------------------------------- archivados ---------------------------------- */

/** Productos eliminados, del más reciente al más antiguo. */
export const listarArchivados = query({
  args: {},
  handler: async (ctx) => {
    await requerirAdmin(ctx);
    const todos = await ctx.db.query("productos").collect();
    const archivados = todos.filter((p) => p.archivado).sort((a, b) => b.archivado!.fecha - a.archivado!.fecha);
    const cats = new Map((await ctx.db.query("categorias").collect()).map((c) => [c._id, c]));
    return archivados.map((p) => {
      const c = cats.get(p.catId);
      return {
        _id: p._id,
        nombre: p.nombre,
        precio: p.precio,
        estado: p.estado,
        imagen: p.imagenes[0]?.url ?? null,
        icono: c?.icono ?? "🛍️",
        catId: p.catId,
        catNombre: p.archivado!.catNombre,
        /** "activa": vuelve a su lugar; "eliminada": se restaura también la categoría; "no-existe": hay que elegir otra. */
        catEstado: !c ? "no-existe" : c.eliminada ? "eliminada" : "activa",
        fecha: p.archivado!.fecha,
      } as const;
    });
  },
});

/** «Eliminar» un producto: pasa a Archivados, desde donde se puede restaurar. */
export const archivar = mutation({
  args: { ids: v.array(v.id("productos")) },
  handler: async (ctx, { ids }) => {
    await requerirAdmin(ctx);
    return await archivarProductos(ctx, ids);
  },
});

/** Saca productos de Archivados: a su lugar original o, con `catId`, al final de esa categoría. */
export const restaurar = mutation({
  args: { ids: v.array(v.id("productos")), catId: v.optional(v.id("categorias")) },
  handler: async (ctx, { ids, catId }) => {
    await requerirAdmin(ctx);
    return await restaurarProductos(ctx, ids, catId);
  },
});

/** Borra para siempre productos archivados. Sin `ids`, vacía Archivados completo. */
export const eliminarDefinitivo = mutation({
  args: { ids: v.optional(v.array(v.id("productos"))) },
  handler: async (ctx, { ids }) => {
    await requerirAdmin(ctx);
    const lista = ids ?? (await ctx.db.query("productos").collect()).filter((p) => p.archivado).map((p) => p._id);
    return await purgarArchivados(ctx, lista);
  },
});

/** Mueve uno o varios productos a otra categoría, al final de ella y manteniendo su orden relativo. */
export const moverCategoria = mutation({
  args: { ids: v.array(v.id("productos")), catId: v.id("categorias") },
  handler: async (ctx, { ids, catId }) => {
    await requerirAdmin(ctx);
    await categoriaActiva(ctx, catId);
    let orden = await siguienteOrden(ctx, catId);
    const docs = [];
    for (const id of ids) {
      const p = await ctx.db.get(id);
      if (p && !p.archivado) docs.push(p);
    }
    docs.sort((a, b) => a.orden - b.orden);
    let movidos = 0;
    const origenes = new Set<Id<"categorias">>();
    for (const p of docs) {
      if (p.catId === catId) continue;
      origenes.add(p.catId);
      await ctx.db.patch(p._id, { catId, orden: orden++ });
      movidos++;
    }
    for (const c of origenes) await renumerar(ctx, await activosDeCategoria(ctx, c));
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
    const actuales = await activosDeCategoria(ctx, catId);
    const porId = new Map(actuales.map((p) => [p._id, p]));
    const finales = [...new Set(ids)].filter((id) => porId.has(id)).map((id) => porId.get(id)!);
    for (const p of actuales) if (!finales.includes(p)) finales.push(p);
    await renumerar(ctx, finales);
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
