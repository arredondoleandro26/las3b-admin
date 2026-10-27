import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import type { OpcionesFondo } from "../lib/imagen";
import { TarjetaEdicion, mensaje } from "./TarjetaEdicion";
import { TarjetaVista } from "./TarjetaVista";
import { useToast } from "../hooks/useToast";
import { useHistorial } from "../hooks/useHistorial";

type Props = {
  cat: Doc<"categorias">;
  productos: Doc<"productos">[]; // ya filtrados por búsqueda, en orden
  categorias: Doc<"categorias">[];
  sel: Set<Id<"productos">>;
  onSeleccion: (id: Id<"productos">, on: boolean) => void;
  onSeleccionarCat: (ids: Id<"productos">[]) => void;
  onAgregarProducto: (catId: Id<"categorias">) => void;
  filtrando: boolean;
  modoVista: boolean;
  fondo: OpcionesFondo;
  esPrimera: boolean;
  esUltima: boolean;
};

export function SeccionCategoria(props: Props) {
  const { cat, productos, categorias, sel, onSeleccion, onSeleccionarCat, onAgregarProducto, filtrando, modoVista, fondo, esPrimera, esUltima } = props;
  const toast = useToast();
  const h = useHistorial();
  const actualizarCat = useMutation(api.categorias.actualizar);
  const desplazar = useMutation(api.categorias.desplazar);
  const eliminarCat = useMutation(api.categorias.eliminar);
  const restaurarCat = useMutation(api.categorias.restaurar);
  const reordenar = useMutation(api.productos.reordenar);

  const [nombre, setNombre] = useState(cat.nombre);
  const [icono, setIcono] = useState(cat.icono);
  useEffect(() => setNombre(cat.nombre), [cat.nombre]);
  useEffect(() => setIcono(cat.icono), [cat.icono]);

  // Orden local para que el arrastre se vea inmediato mientras la mutación viaja
  const [ids, setIds] = useState<Id<"productos">[]>(() => productos.map((p) => p._id));
  useEffect(() => setIds(productos.map((p) => p._id)), [productos]);
  const porId = new Map(productos.map((p) => [p._id, p]));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const a = active.id as Id<"productos">, o = over.id as Id<"productos">;
    let nuevo: Id<"productos">[];
    const grupo = sel.has(a) ? ids.filter((id) => sel.has(id)) : [a];
    if (grupo.length > 1) {
      // mueve el bloque de seleccionados completo hasta la posición del destino
      const resto = ids.filter((id) => !grupo.includes(id));
      const posDestino = resto.indexOf(o);
      const idxA = ids.indexOf(a), idxO = ids.indexOf(o);
      const insertar = posDestino < 0 ? resto.length : idxA < idxO ? posDestino + 1 : posDestino;
      nuevo = [...resto.slice(0, insertar), ...grupo, ...resto.slice(insertar)];
    } else {
      nuevo = arrayMove(ids, ids.indexOf(a), ids.indexOf(o));
    }
    const previo = ids, catId = cat._id;
    setIds(nuevo);
    void h.ejecutar({
      etiqueta: "cambio de orden",
      rehacer: () => reordenar({ catId, ids: nuevo }),
      deshacer: () => reordenar({ catId, ids: previo }),
      refs: { categorias: [catId] },
    }).catch((er) => toast(mensaje(er)));
  }

  async function borrarCategoria() {
    const n = productos.length;
    const ok = confirm(
      `¿Eliminar la categoría “${cat.nombre}”${n ? ` y sus ${n} productos` : ""}?` +
        (n ? "\n\nSus productos se moverán a «Archivados» y podrás restaurarlos." : ""),
    );
    if (!ok) return;
    const id = cat._id;
    try {
      let archivados = await eliminarCat({ id });
      const k = archivados.length;
      h.registrar({
        etiqueta: `categoría “${cat.nombre}” eliminada`,
        rehacer: async () => { archivados = await eliminarCat({ id }); },
        deshacer: () => restaurarCat({ id, productos: archivados }),
        refs: { categorias: [id], productos: archivados },
      });
      h.avisoDeshacer(`🗑 Categoría “${cat.nombre}” eliminada${k ? `; sus ${k} producto${k === 1 ? "" : "s"} están en Archivados` : ""}`);
    } catch (e) { toast(mensaje(e)); }
  }

  function cambiarCat(cambios: { nombre?: string; icono?: string }) {
    const id = cat._id;
    const previo = { nombre: cambios.nombre !== undefined ? cat.nombre : undefined, icono: cambios.icono !== undefined ? cat.icono : undefined };
    void h.ejecutar({
      etiqueta: cambios.nombre !== undefined ? "nombre de categoría" : "icono de categoría",
      rehacer: () => actualizarCat({ id, ...cambios }),
      deshacer: () => actualizarCat({ id, ...previo }),
      refs: { categorias: [id] },
    }).catch((er) => toast(mensaje(er)));
  }

  function moverCat(direccion: -1 | 1) {
    const id = cat._id;
    void h.ejecutar({
      etiqueta: "orden de categorías",
      rehacer: () => desplazar({ id, direccion }),
      deshacer: () => desplazar({ id, direccion: direccion === 1 ? -1 : 1 }),
      refs: { categorias: [id] },
    }).catch((er) => toast(mensaje(er)));
  }

  if (!productos.length && filtrando) return null;

  if (modoVista) {
    if (!productos.length) return null;
    return (
      <section className="cat" id={`cat-${cat._id}`}>
        <div className="cat-head">
          <span className="cat-icon">{cat.icono}</span>
          <h2>{cat.nombre}</h2>
          <span className="count">{productos.length} producto{productos.length === 1 ? "" : "s"}</span>
        </div>
        <div className="grid">
          {productos.map((p) => (
            <TarjetaVista key={p._id} p={{ ...p, imagenes: p.imagenes.map((i) => i.url), icono: cat.icono }} />
          ))}
        </div>
      </section>
    );
  }

  const arrastrable = !filtrando;

  return (
    <section className="cat" id={`cat-${cat._id}`}>
      <div className="cat-head edit">
        <input className="cat-icon edit-icon" aria-label="Icono" maxLength={4} value={icono}
          onChange={(e) => setIcono(e.target.value)}
          onBlur={() => { const v = icono.trim(); if (v && v !== cat.icono) cambiarCat({ icono: v }); else setIcono(cat.icono); }} />
        <input className="cat-name" aria-label="Nombre de la categoría" value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          onBlur={() => { const v = nombre.trim(); if (v && v !== cat.nombre) cambiarCat({ nombre: v }); else setNombre(cat.nombre); }}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
        <span className="cat-actions">
          <button type="button" title="Seleccionar / quitar todos los productos de esta categoría" onClick={() => onSeleccionarCat(productos.map((p) => p._id))}>☑</button>
          <button type="button" title="Subir categoría" disabled={esPrimera} onClick={() => moverCat(-1)}>↑</button>
          <button type="button" title="Bajar categoría" disabled={esUltima} onClick={() => moverCat(1)}>↓</button>
          <button type="button" title="Eliminar categoría" onClick={() => void borrarCategoria()}>🗑</button>
        </span>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={ids} strategy={rectSortingStrategy}>
          <div className="grid">
            {ids.map((id) => {
              const p = porId.get(id);
              return p ? (
                <TarjetaEdicion key={id} p={p} categorias={categorias} seleccionado={sel.has(id)} onSeleccion={onSeleccion} fondo={fondo} arrastrable={arrastrable} />
              ) : null;
            })}
            <button type="button" className="addcard" onClick={() => onAgregarProducto(cat._id)}><span>＋</span>Agregar producto</button>
          </div>
        </SortableContext>
      </DndContext>
    </section>
  );
}
