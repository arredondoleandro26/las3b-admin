import { ConvexError, v } from "convex/values";
import { internalAction, internalMutation, mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { requerirAdmin } from "./lib/acceso";
import { ajustesCampos, estadoValidator } from "./lib/validadores";
import { obtenerOCrearAjustes } from "./ajustes";

/**
 * Importación del catálogo HTML antiguo. Dos caminos:
 *  1) Desde el panel (mutaciones públicas, exigen admin): el navegador parsea el archivo, sube las
 *     imágenes y llama por lotes a `categorias`, `productos` y `ajustes`.
 *  2) Desde la línea de comandos (funciones internas, solo vía `npx convex run`): se sube el JSON al
 *     storage y la acción `desdeArchivo` hace todo en el servidor. Ver README.
 */

/* ---------------------------------- lógica compartida ---------------------------------- */

async function vaciarImpl(ctx: MutationCtx) {
  const productos = await ctx.db.query("productos").collect();
  for (const p of productos) {
    for (const img of p.imagenes) await ctx.storage.delete(img.storageId).catch(() => {});
    await ctx.db.delete(p._id);
  }
  const categorias = await ctx.db.query("categorias").collect();
  for (const c of categorias) await ctx.db.delete(c._id);
  return { productos: productos.length, categorias: categorias.length };
}

const categoriaItem = v.object({ idAntiguo: v.string(), nombre: v.string(), icono: v.string() });
type CategoriaItem = { idAntiguo: string; nombre: string; icono: string };

async function categoriasImpl(ctx: MutationCtx, items: CategoriaItem[]) {
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
}

const productoItem = v.object({
  catId: v.id("categorias"),
  nombre: v.string(),
  precio: v.number(),
  estado: estadoValidator,
  oferta: v.optional(v.boolean()),
  antes: v.optional(v.number()),
  orden: v.number(),
  imagenes: v.array(v.id("_storage")),
});
type ProductoItem = {
  catId: Id<"categorias">;
  nombre: string;
  precio: number;
  estado: "disponible" | "sinstock" | "descontinuado";
  oferta?: boolean;
  antes?: number;
  orden: number;
  imagenes: Id<"_storage">[];
};

async function productosImpl(ctx: MutationCtx, items: ProductoItem[]) {
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
}

type AjustesArgs = {
  nombre: string; titulo: string; periodo: string; precioNota: string;
  aviso: string; whatsapp: string; pie: string; color: string;
  bannerId?: Id<"_storage">;
};

async function ajustesImpl(ctx: MutationCtx, { bannerId, ...campos }: AjustesArgs) {
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
}

/* ------------------------- camino 1: mutaciones públicas (panel admin) ------------------------- */

/** Borra categorías, productos e imágenes. Se usa cuando el usuario elige "reemplazar todo". */
export const vaciar = mutation({
  args: {},
  handler: async (ctx) => {
    await requerirAdmin(ctx);
    return vaciarImpl(ctx);
  },
});

/** Crea las categorías en orden y devuelve el mapa idAntiguo -> idNuevo. */
export const categorias = mutation({
  args: { items: v.array(categoriaItem) },
  handler: async (ctx, { items }) => {
    await requerirAdmin(ctx);
    return categoriasImpl(ctx, items);
  },
});

/** Inserta un lote de productos (máx. 100 por llamada). */
export const productos = mutation({
  args: { items: v.array(productoItem) },
  handler: async (ctx, { items }) => {
    await requerirAdmin(ctx);
    return productosImpl(ctx, items);
  },
});

/** Ajustes del negocio + banner (opcional) en un solo paso. */
export const ajustes = mutation({
  args: { ...ajustesCampos, bannerId: v.optional(v.id("_storage")) },
  handler: async (ctx, args) => {
    await requerirAdmin(ctx);
    await ajustesImpl(ctx, args);
  },
});

/* --------------------- camino 2: funciones internas (solo `npx convex run`) --------------------- */

export const vaciarInterno = internalMutation({ args: {}, handler: (ctx) => vaciarImpl(ctx) });
export const categoriasInterno = internalMutation({ args: { items: v.array(categoriaItem) }, handler: (ctx, { items }) => categoriasImpl(ctx, items) });
export const productosInterno = internalMutation({ args: { items: v.array(productoItem) }, handler: (ctx, { items }) => productosImpl(ctx, items) });
export const ajustesInterno = internalMutation({
  args: { ...ajustesCampos, bannerId: v.optional(v.id("_storage")) },
  handler: (ctx, args) => ajustesImpl(ctx, args),
});

/** URL temporal para subir el archivo del catálogo (HTML o JSON) al storage antes de procesarlo. */
export const urlSubidaInterna = internalMutation({ args: {}, handler: (ctx) => ctx.storage.generateUploadUrl() });

type CatalogoAntiguo = {
  meta?: { nombre?: string; titulo?: string; periodo?: string; precioNota?: string; aviso?: string; whatsapp?: string; pie?: string; color?: string };
  categorias: { id: string; nombre: string; icono: string }[];
  productos: { id: string; cat: string; nombre: string; precio: number; estado: string; imgs?: string[]; oferta?: boolean; antes?: number | null }[];
  imagenes: Record<string, string>;
};

function extraerJSON(texto: string): CatalogoAntiguo {
  let json = texto.trim();
  if (!json.startsWith("{")) {
    const m = /<script[^>]*id="catalog-data"[^>]*>([\s\S]*?)<\/script>/i.exec(texto);
    if (!m) throw new ConvexError("No encontré los datos del catálogo en ese archivo.");
    json = m[1];
  }
  const d = JSON.parse(json) as CatalogoAntiguo;
  if (!Array.isArray(d.categorias) || !Array.isArray(d.productos) || typeof d.imagenes !== "object") {
    throw new ConvexError("El archivo no tiene la estructura esperada (categorias, productos, imagenes).");
  }
  return d;
}

function dataUriABlob(uri: string): Blob {
  const m = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(uri);
  if (!m) throw new Error("Data URI inválido");
  if (!m[2]) return new Blob([decodeURIComponent(m[3])], { type: m[1] });
  const bin = atob(m[3]);
  const a = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  return new Blob([a], { type: m[1] });
}

/**
 * Procesa en el servidor un catálogo antiguo ya subido al storage: guarda cada imagen con
 * ctx.storage.store, crea categorías y productos por lotes y aplica los ajustes. Al terminar borra
 * el archivo fuente. Uso: npx convex run importar:desdeArchivo '{"storageId":"...","reemplazar":true}'
 */
export const desdeArchivo = internalAction({
  args: { storageId: v.id("_storage"), reemplazar: v.optional(v.boolean()) },
  handler: async (ctx, { storageId, reemplazar }) => {
    const archivo = await ctx.storage.get(storageId);
    if (!archivo) throw new ConvexError("No existe el archivo en el storage.");
    const d = extraerJSON(await archivo.text());

    if (reemplazar) await ctx.runMutation(internal.importar.vaciarInterno, {});

    // 1) imágenes usadas (productos + banner), de a 8 en paralelo
    const usadas = new Set<string>();
    d.productos.forEach((p) => (p.imgs ?? []).forEach((i) => { if (d.imagenes[i]) usadas.add(i); }));
    if (d.imagenes.banner) usadas.add("banner");
    const ids = [...usadas];
    const mapaImg = new Map<string, Id<"_storage">>();
    let fallidas = 0;
    for (let i = 0; i < ids.length; i += 8) {
      await Promise.all(
        ids.slice(i, i + 8).map(async (id) => {
          try { mapaImg.set(id, await ctx.storage.store(dataUriABlob(d.imagenes[id]))); }
          catch (e) { fallidas++; console.error("imagen", id, e); }
        }),
      );
    }

    // 2) categorías
    const mapaCat = await ctx.runMutation(internal.importar.categoriasInterno, {
      items: d.categorias.map((c) => ({ idAntiguo: c.id, nombre: c.nombre, icono: c.icono })),
    });

    // 3) productos por lotes, conservando el orden dentro de cada categoría
    const ordenPorCat = new Map<string, number>();
    const items: ProductoItem[] = d.productos
      .filter((p) => mapaCat[p.cat])
      .map((p) => {
        const orden = ordenPorCat.get(p.cat) ?? 0;
        ordenPorCat.set(p.cat, orden + 1);
        return {
          catId: mapaCat[p.cat],
          nombre: p.nombre,
          precio: Number(p.precio) || 0,
          estado: p.estado === "sinstock" || p.estado === "descontinuado" ? p.estado : "disponible",
          oferta: p.oferta ? true : undefined,
          antes: p.antes ? Number(p.antes) : undefined,
          orden,
          imagenes: (p.imgs ?? []).map((i) => mapaImg.get(i)).filter((x): x is Id<"_storage"> => !!x),
        };
      });
    let insertados = 0;
    for (let i = 0; i < items.length; i += 50) {
      insertados += await ctx.runMutation(internal.importar.productosInterno, { items: items.slice(i, i + 50) });
    }

    // 4) ajustes + banner
    const m = d.meta ?? {};
    await ctx.runMutation(internal.importar.ajustesInterno, {
      nombre: m.nombre ?? "Mi negocio",
      titulo: m.titulo ?? "Catálogo de productos",
      periodo: m.periodo ?? "",
      precioNota: m.precioNota ?? "",
      aviso: m.aviso ?? "",
      whatsapp: m.whatsapp ?? "",
      pie: m.pie ?? "",
      color: m.color ?? "#0b7f80",
      bannerId: mapaImg.get("banner"),
    });

    await ctx.storage.delete(storageId).catch(() => {});

    return {
      categorias: d.categorias.length,
      productos: insertados,
      omitidos: d.productos.length - items.length,
      imagenes: mapaImg.size,
      imagenesFallidas: fallidas,
      banner: mapaImg.has("banner"),
    };
  },
});
