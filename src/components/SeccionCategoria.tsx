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
  const actualizarCat = useMutation(api.categorias.actualizar);
  const desplazar = useMutation(api.categorias.desplazar);
  const eliminarCat = useMutation(api.categorias.eliminar);
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
    setIds(nuevo);
    void reordenar({ catId: cat._id, ids: nuevo }).catch((er) => toast(mensaje(er)));
  }

  async function borrarCategoria() {
    const n = productos.length;
    const ok = confirm(
      `¿Eliminar la categoría “${cat.nombre}”${n ? ` y sus ${n} productos` : ""}?` +
        (n ? "\n\nSi quieres conservar los productos, cancela y muévelos antes a otra categoría (botón ☑ de la categoría y luego «Mover a otra categoría»)." : ""),
    );
    if (!ok) return;
    try { await eliminarCat({ id: cat._id }); toast(`🗑 Categoría “${cat.nombre}” eliminada`); } catch (e) { toast(mensaje(e)); }
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
          onBlur={() => { const v = icono.trim(); if (v && v !== cat.icono) void actualizarCat({ id: cat._id, icono: v }).catch((er) => toast(mensaje(er))); else setIcono(cat.icono); }} />
        <input className="cat-name" aria-label="Nombre de la categoría" value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          onBlur={() => { const v = nombre.trim(); if (v && v !== cat.nombre) void actualizarCat({ id: cat._id, nombre: v }).catch((er) => toast(mensaje(er))); else setNombre(cat.nombre); }}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
        <span className="cat-actions">
          <button type="button" title="Seleccionar / quitar todos los productos de esta categoría" onClick={() => onSeleccionarCat(productos.map((p) => p._id))}>☑</button>
          <button type="button" title="Subir categoría" disabled={esPrimera} onClick={() => void desplazar({ id: cat._id, direccion: -1 })}>↑</button>
          <button type="button" title="Bajar categoría" disabled={esUltima} onClick={() => void desplazar({ id: cat._id, direccion: 1 })}>↓</button>
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
