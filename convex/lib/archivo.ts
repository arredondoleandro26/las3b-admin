import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

/**
 * Archivar en vez de borrar: un producto eliminado conserva su id, sus imágenes y su lugar
 * (`archivado.ancla`), así que restaurarlo o deshacer la eliminación lo deja exactamente donde estaba.
 * Una categoría eliminada se marca con `eliminada` por la misma razón.
 */

/** Productos visibles de una categoría (sin archivados), en orden. */
export async function activosDeCategoria(ctx: QueryCtx, catId: Id<"categorias">) {
  const lista = await ctx.db.query("productos").withIndex("por_categoria", (q) => q.eq("catId", catId)).collect();
  return lista.filter((p) => !p.archivado).sort((a, b) => a.orden - b.orden);
}

/** Categorías no eliminadas, en orden. */
export async function categoriasActivas(ctx: QueryCtx) {
  return (await ctx.db.query("categorias").withIndex("por_orden").collect()).filter((c) => !c.eliminada);
}

/** Reescribe `orden` como 0..n-1 siguiendo la lista recibida (solo toca los que cambian). */
export async function renumerar(ctx: MutationCtx, docs: Array<{ _id: Id<"productos"> | Id<"categorias">; orden: number }>) {
  await Promise.all(docs.map((d, i) => (d.orden === i ? null : ctx.db.patch(d._id, { orden: i }))));
}

/** Manda productos a Archivados. `catNombre` permite fijar el nombre a mostrar (al eliminar la categoría). */
export async function archivarProductos(ctx: MutationCtx, ids: Id<"productos">[], catNombre?: string) {
  const fecha = Date.now();
  const porCat = new Map<Id<"categorias">, Set<Id<"productos">>>();
  for (const id of ids) {
    const p = await ctx.db.get(id);
    if (!p || p.archivado) continue;
    if (!porCat.has(p.catId)) porCat.set(p.catId, new Set());
    porCat.get(p.catId)!.add(id);
  }
  let n = 0;
  for (const [catId, set] of porCat) {
    const cat = await ctx.db.get(catId);
    const lista = await activosDeCategoria(ctx, catId);
    for (let i = 0; i < lista.length; i++) {
      if (!set.has(lista[i]._id)) continue;
      await ctx.db.patch(lista[i]._id, {
        archivado: { fecha, catNombre: catNombre ?? cat?.nombre ?? "", ancla: i > 0 ? lista[i - 1]._id : null },
      });
      n++;
    }
    await renumerar(ctx, lista.filter((p) => !set.has(p._id)));
  }
  return n;
}

/** Vuelve a mostrar una categoría eliminada, en el lugar que ocupaba. */
export async function revivirCategoria(ctx: MutationCtx, cat: Doc<"categorias">) {
  if (!cat.eliminada) return;
  const activas = await categoriasActivas(ctx);
  const pos = Math.min(Math.max(cat.orden, 0), activas.length);
  await ctx.db.patch(cat._id, { eliminada: undefined });
  activas.splice(pos, 0, cat);
  await renumerar(ctx, activas);
}

/**
 * Saca productos de Archivados. Sin `catId` vuelven a su categoría y a su lugar (si la categoría se
 * eliminó, también se restaura); con `catId` van al final de esa categoría.
 */
export async function restaurarProductos(ctx: MutationCtx, ids: Id<"productos">[], catId?: Id<"categorias">) {
  const docs: Doc<"productos">[] = [];
  for (const id of ids) {
    const p = await ctx.db.get(id);
    if (p?.archivado) docs.push(p);
  }
  // en el orden que tenían, para que cada uno encuentre ya restaurado al que tenía delante
  docs.sort((a, b) => a.orden - b.orden);

  let destinoElegido: Doc<"categorias"> | null = null;
  if (catId) {
    destinoElegido = await ctx.db.get(catId);
    if (!destinoElegido || destinoElegido.eliminada) throw new ConvexError("La categoría de destino no existe.");
  }

  for (const p of docs) {
    const cat = destinoElegido ?? (await ctx.db.get(p.catId));
    if (!cat) throw new ConvexError(`La categoría de «${p.nombre}» ya no existe: elige otra para restaurarlo.`);
    if (cat.eliminada) await revivirCategoria(ctx, cat);

    const lista = await activosDeCategoria(ctx, cat._id);
    let pos = lista.length; // por defecto, al final
    if (cat._id === p.catId) {
      // sigue la cadena de anclas: si el de delante también está archivado, se usa el suyo
      let ancla = p.archivado!.ancla;
      const vistos = new Set<string>();
      while (ancla && !vistos.has(ancla)) {
        vistos.add(ancla);
        const j = lista.findIndex((q) => q._id === ancla);
        if (j >= 0) { pos = j + 1; break; }
        const a = await ctx.db.get(ancla);
        if (!a?.archivado || a.catId !== cat._id) break;
        ancla = a.archivado.ancla;
      }
      if (ancla === null) pos = 0;
    }
    await ctx.db.patch(p._id, { archivado: undefined, catId: cat._id });
    lista.splice(pos, 0, { ...p, catId: cat._id, archivado: undefined, orden: -1 });
    await renumerar(ctx, lista);
  }
  return docs.length;
}

/** Elimina para siempre productos archivados (con sus imágenes) y las categorías eliminadas que quedan vacías. */
export async function purgarArchivados(ctx: MutationCtx, ids: Id<"productos">[]) {
  const cats = new Set<Id<"categorias">>();
  let productos = 0;
  for (const id of ids) {
    const p = await ctx.db.get(id);
    if (!p?.archivado) continue;
    for (const img of p.imagenes) await ctx.storage.delete(img.storageId).catch(() => {});
    await ctx.db.delete(id);
    cats.add(p.catId);
    productos++;
  }
  const categorias: Id<"categorias">[] = [];
  for (const catId of cats) {
    const c = await ctx.db.get(catId);
    if (!c?.eliminada) continue;
    const queda = await ctx.db.query("productos").withIndex("por_categoria", (q) => q.eq("catId", catId)).first();
    if (!queda) { await ctx.db.delete(catId); categorias.push(catId); }
  }
  return { productos, categorias };
}
