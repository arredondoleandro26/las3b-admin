import { query } from "./_generated/server";
import { AJUSTES_POR_DEFECTO, CONTACTO_VACIO } from "./lib/validadores";
import { categoriasActivas } from "./lib/archivo";
import { precioPublico } from "./lib/precio";

/**
 * Query PÚBLICA: todo lo que necesita el catálogo para pintarse.
 * Es la única función que consume el repo las3b-catalogo. No requiere sesión.
 * Oculta los productos descontinuados y archivados (y las categorías eliminadas) y nunca expone ids de storage.
 */
export const obtener = query({
  args: {},
  handler: async (ctx) => {
    const a = await ctx.db.query("ajustes").first();
    const categorias = await categoriasActivas(ctx);
    const productos = await ctx.db.query("productos").collect();

    const ajustes = {
      nombre: a?.nombre ?? AJUSTES_POR_DEFECTO.nombre,
      titulo: a?.titulo ?? AJUSTES_POR_DEFECTO.titulo,
      periodo: a?.periodo ?? AJUSTES_POR_DEFECTO.periodo,
      precioNota: a?.precioNota ?? AJUSTES_POR_DEFECTO.precioNota,
      aviso: a?.aviso ?? AJUSTES_POR_DEFECTO.aviso,
      whatsapp: a?.whatsapp ?? AJUSTES_POR_DEFECTO.whatsapp,
      pie: a?.pie ?? AJUSTES_POR_DEFECTO.pie,
      color: a?.color ?? AJUSTES_POR_DEFECTO.color,
      bannerUrl: a?.bannerUrl ?? null,
      contacto: a?.contacto ?? CONTACTO_VACIO,
    };

    return {
      ajustes,
      categorias: categorias.map((c) => ({ _id: c._id, nombre: c.nombre, icono: c.icono, orden: c.orden })),
      productos: productos
        .filter((p) => p.estado !== "descontinuado" && !p.archivado)
        .sort((x, y) => x.orden - y.orden)
        .map((p) => ({
          _id: p._id,
          catId: p.catId,
          nombre: p.nombre,
          // Con precio de oferta, «precio» ya viene rebajado y «antes» trae el precio normal:
          // el catálogo lo muestra y cobra sin cambios en su código.
          ...precioPublico(p),
          estado: p.estado,
          orden: p.orden,
          oferta: p.oferta ?? false,
          imagenes: p.imagenes.map((i) => i.url),
        })),
    };
  },
});
