import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useHistorial } from "./useHistorial";

/** Acciones que se usan desde más de un lugar del panel, ya conectadas a deshacer / rehacer. */
export function useAcciones() {
  const h = useHistorial();
  const mover = useMutation(api.productos.moverCategoria);
  const reordenar = useMutation(api.productos.reordenar);
  const archivar = useMutation(api.productos.archivar);
  const restaurar = useMutation(api.productos.restaurar);
  const eliminarCat = useMutation(api.categorias.eliminar);
  const restaurarCat = useMutation(api.categorias.restaurar);

  /**
   * Mueve productos a otra categoría. Deshacer los devuelve a sus categorías y a su lugar.
   * `catNueva`: categoría recién creada para este movimiento (deshacer también la quita).
   */
  async function moverProductos(ids: Id<"productos">[], catId: Id<"categorias">, catNueva = false) {
    const r = await mover({ ids, catId });
    if (r.movidos || catNueva) {
      const deshacerMover = async () => {
        for (const o of r.origenes) {
          await mover({ ids: o.movidos, catId: o.catId });
          await reordenar({ catId: o.catId, ids: o.ids });
        }
      };
      h.registrar({
        etiqueta: r.movidos === 1 ? "producto movido de categoría" : `${r.movidos} productos movidos de categoría`,
        rehacer: async () => { if (catNueva) await restaurarCat({ id: catId, productos: [] }); await mover({ ids, catId }); },
        deshacer: async () => { await deshacerMover(); if (catNueva) await eliminarCat({ id: catId }); },
        refs: { productos: ids, categorias: [catId] },
      });
    }
    return r.movidos;
  }

  /** «Eliminar» productos: van a Archivados, con aviso para deshacer. */
  async function eliminarProductos(ids: Id<"productos">[], aviso: string) {
    await h.ejecutar({
      etiqueta: ids.length === 1 ? "producto eliminado" : `${ids.length} productos eliminados`,
      rehacer: () => archivar({ ids }),
      deshacer: () => restaurar({ ids }),
      refs: { productos: ids },
    });
    h.avisoDeshacer(aviso);
  }

  return { moverProductos, eliminarProductos };
}
