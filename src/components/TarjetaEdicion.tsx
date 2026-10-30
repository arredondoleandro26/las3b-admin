import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { useMutation } from "convex/react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import { ESTADOS, type Estado } from "../lib/formato";
import { MENSAJE_FONDO_FALLO, procesarProducto, type OpcionesFondo } from "../lib/imagen";
import { useSubirArchivo } from "../lib/subir";
import { useToast } from "../hooks/useToast";
import { useHistorial } from "../hooks/useHistorial";
import { useConfirmar } from "../hooks/useConfirmar";
import { useAcciones } from "../hooks/useAcciones";
import { mensaje } from "../lib/errores";
import { CargandoBurbujas } from "./CargandoBurbujas";

type Props = {
  p: Doc<"productos">;
  categorias: Doc<"categorias">[];
  seleccionado: boolean;
  onSeleccion: (id: Id<"productos">, on: boolean) => void;
  fondo: OpcionesFondo;
  arrastrable: boolean;
};

export function TarjetaEdicion({ p, categorias, seleccionado, onSeleccion, fondo, arrastrable }: Props) {
  const toast = useToast();
  const h = useHistorial();
  const confirmar = useConfirmar();
  const { moverProductos, eliminarProductos } = useAcciones();
  const actualizar = useMutation(api.productos.actualizar);
  const fijarImagenes = useMutation(api.productos.fijarImagenes);
  const subir = useSubirArchivo();

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: p._id, disabled: !arrastrable });

  // Campos de texto: se editan localmente y se guardan al salir del campo (o con Enter)
  const [nombre, setNombre] = useState(p.nombre);
  const [precio, setPrecio] = useState(String(p.precio));
  const [antes, setAntes] = useState(p.antes ? String(p.antes) : "");
  const [precioOferta, setPrecioOferta] = useState(p.precioOferta ? String(p.precioOferta) : "");
  /** Editor de oferta abierto en un producto que aún no está en oferta (el badge se activa solo al guardar). */
  const [editandoOferta, setEditandoOferta] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [drag, setDrag] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const modo = useRef<{ tipo: "add" } | { tipo: "replace"; i: number }>({ tipo: "add" });

  useEffect(() => { setNombre(p.nombre); }, [p.nombre]);
  useEffect(() => { setPrecio(String(p.precio)); }, [p.precio]);
  useEffect(() => { setAntes(p.antes ? String(p.antes) : ""); }, [p.antes]);
  useEffect(() => { setPrecioOferta(p.precioOferta ? String(p.precioOferta) : ""); }, [p.precioOferta]);

  type Cambios = { nombre?: string; precio?: number; estado?: Estado; oferta?: boolean; antes?: number | null; precioOferta?: number | null };
  const ETIQUETAS: Record<keyof Cambios, string> = { nombre: "cambio de nombre", precio: "cambio de precio", estado: "cambio de estado", oferta: "cambio de oferta", antes: "cambio de precio anterior", precioOferta: "cambio de precio de oferta" };

  async function guardar(cambios: Cambios): Promise<boolean> {
    const previo: Cambios = {};
    for (const k of Object.keys(cambios) as (keyof Cambios)[]) {
      if (k === "antes") previo.antes = p.antes ?? null;
      else if (k === "precioOferta") previo.precioOferta = p.precioOferta ?? null;
      else Object.assign(previo, { [k]: p[k] ?? false });
    }
    const id = p._id;
    setGuardando(true);
    try {
      await h.ejecutar({
        etiqueta: ETIQUETAS[Object.keys(cambios)[0] as keyof Cambios],
        rehacer: () => actualizar({ id, ...cambios }),
        deshacer: () => actualizar({ id, ...previo }),
        refs: { productos: [id] },
      });
      return true;
    }
    catch (e) { toast(mensaje(e)); return false; }
    finally { setGuardando(false); }
  }

  function guardarNombre() { const v = nombre.trim(); if (!v) { setNombre(p.nombre); return; } if (v !== p.nombre) void guardar({ nombre: v }); }
  function guardarPrecio() { const v = Math.max(0, parseInt(precio, 10) || 0); setPrecio(String(v)); if (v !== p.precio) void guardar({ precio: v }); }
  const ofertaCambiada = !p.oferta || (Math.max(0, parseInt(precioOferta, 10) || 0) || null) !== (p.precioOferta ?? null);
  /** Guarda el precio de oferta y marca el producto en oferta, en un solo paso del historial. */
  async function guardarPrecioOferta() {
    const v = Math.max(0, parseInt(precioOferta, 10) || 0);
    if (!v) { toast("Escribe el precio de oferta."); return; }
    setPrecioOferta(String(v));
    if (p.oferta && v === p.precioOferta) return;
    if (v >= p.precio) toast("⚠️ El precio de oferta debería ser menor que el precio normal.");
    if (await guardar({ oferta: true, precioOferta: v })) setEditandoOferta(false);
  }
  function cancelarOferta() {
    setEditandoOferta(false);
    setPrecioOferta(p.precioOferta ? String(p.precioOferta) : "");
  }
  function quitarOferta() { void guardar({ oferta: false, precioOferta: null }); }
  function guardarAntes() { const v = Math.max(0, parseInt(antes, 10) || 0); setAntes(v ? String(v) : ""); if ((v || null) !== (p.antes ?? null)) void guardar({ antes: v || null }); }

  /** Cambia la lista de imágenes como un solo paso del historial. */
  async function cambiarImagenes(siguiente: Id<"_storage">[], etiqueta: string) {
    const id = p._id, previa = p.imagenes.map((i) => i.storageId);
    await h.ejecutar({
      etiqueta,
      rehacer: () => fijarImagenes({ id, storageIds: siguiente }),
      deshacer: () => fijarImagenes({ id, storageIds: previa }),
      refs: { productos: [id] },
    });
  }

  async function procesarArchivos(files: FileList | File[]) {
    const imgs = [...files].filter((f) => f.type.startsWith("image/"));
    if (!imgs.length) return toast("Ese archivo no es una imagen.");
    setSubiendo(true);
    try {
      let fallo = false;
      const nuevas: Id<"_storage">[] = [];
      for (const f of imgs) {
        const r = await procesarProducto(f, fondo);
        if (r.removed === false) fallo = true;
        nuevas.push(await subir(r.blob));
      }
      const actuales = p.imagenes.map((i) => i.storageId);
      const m = modo.current;
      modo.current = { tipo: "add" };
      if (m.tipo === "replace" && m.i < actuales.length) {
        await cambiarImagenes(actuales.map((s, k) => (k === m.i ? nuevas[0] : s)).concat(nuevas.slice(1)), "imagen reemplazada");
      } else {
        await cambiarImagenes([...actuales, ...nuevas], nuevas.length === 1 ? "imagen agregada" : "imágenes agregadas");
      }
      if (fallo) toast(MENSAJE_FONDO_FALLO, 6500);
    } catch (e) { toast(mensaje(e)); }
    finally { setSubiendo(false); }
  }

  function quitar(k: number) {
    void cambiarImagenes(p.imagenes.filter((_, j) => j !== k).map((i) => i.storageId), "imagen quitada").catch((er) => toast(mensaje(er)));
  }

  function elegir(m: typeof modo.current) { modo.current = m; if (picker.current) { picker.current.value = ""; picker.current.click(); } }
  function onPick(e: ChangeEvent<HTMLInputElement>) { if (e.target.files?.length) void procesarArchivos(e.target.files); }
  function onDrop(e: DragEvent) { e.preventDefault(); setDrag(false); modo.current = { tipo: "add" }; void procesarArchivos(e.dataTransfer.files); }

  async function borrar() {
    if (!(await confirmar({ titulo: `¿Eliminar «${p.nombre}»?`, mensaje: "Se moverá a «Archivados»: ahí podrás restaurarlo o eliminarlo para siempre.", aceptar: "🗑 Eliminar", peligro: true }))) return;
    try { await eliminarProductos([p._id], `🗑 «${p.nombre}» eliminado: quedó en Archivados`); } catch (e) { toast(mensaje(e)); }
  }

  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`card edit ${p.estado}${seleccionado ? " selected" : ""}${isDragging ? " dnd-ghost" : ""}${drag ? " drag" : ""}`}
      data-id={p._id}
      onDragOver={(e) => { if ([...e.dataTransfer.types].includes("Files")) { e.preventDefault(); setDrag(true); } }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDrag(false); }}
      onDrop={onDrop}
    >
      {(guardando || subiendo) && <CargandoBurbujas texto={subiendo ? "Subiendo imagen…" : "Guardando…"} />}
      <div className="cardtop">
        <label className="selbox">
          <input type="checkbox" checked={seleccionado} onChange={(e) => onSeleccion(p._id, e.target.checked)} /> Seleccionar
        </label>
        {arrastrable && (
          <span className="grip" title="Arrastra para cambiar de lugar dentro de la categoría" {...attributes} {...listeners}>⠿ Mover</span>
        )}
      </div>

      <div className="thumbs">
        {p.imagenes.map((img, k) => (
          <button key={img.storageId} type="button" className="thumb" title="Clic para reemplazar esta imagen" onClick={() => elegir({ tipo: "replace", i: k })}>
            <img src={img.url} alt="" />
            <span
              className="x"
              role="button"
              title="Quitar imagen"
              onClick={(e) => { e.stopPropagation(); quitar(k); }}
            >✕</span>
          </button>
        ))}
        <button type="button" className="addimg" title="Agregar imagen" disabled={subiendo} onClick={() => elegir({ tipo: "add" })}>
          <span>{subiendo ? "…" : "＋"}</span>{subiendo ? "Subiendo" : "Imagen"}
        </button>
        <div className="hint">…o arrastra una imagen aquí</div>
        <input ref={picker} type="file" accept="image/*" multiple hidden onChange={onPick} />
      </div>

      <textarea
        rows={2}
        aria-label="Nombre del producto"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        onBlur={guardarNombre}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLTextAreaElement).blur(); } }}
      />
      <div className="row2">
        <label className="money">$
          <input type="number" min={0} step={1} inputMode="numeric" aria-label="Precio" value={precio}
            onChange={(e) => setPrecio(e.target.value)} onBlur={guardarPrecio}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
          <span className="cu">c/u</span>
        </label>
      </div>
      <select aria-label="Estado" value={p.estado} onChange={(e) => void guardar({ estado: e.target.value as Estado })}>
        {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <label className="fld">Categoría
        <select aria-label="Mover a otra categoría" value={p.catId}
          onChange={(e) => {
            setGuardando(true);
            void moverProductos([p._id], e.target.value as Id<"categorias">).then(() => toast("✅ Producto movido de categoría")).catch((er) => toast(mensaje(er))).finally(() => setGuardando(false));
          }}>
          {categorias.map((c) => <option key={c._id} value={c._id}>{c.icono} {c.nombre}</option>)}
        </select>
      </label>
      {!p.oferta && !editandoOferta ? (
        <button type="button" className="btn poner-of" onClick={() => setEditandoOferta(true)}>🏷️ Poner en oferta</button>
      ) : (
        <div className="oferta-ed">
          <div className="row2">
            <label className="money">$
              <input type="number" min={0} step={1} inputMode="numeric" aria-label="Precio de oferta" placeholder="Precio oferta" value={precioOferta}
                onChange={(e) => setPrecioOferta(e.target.value)}
                autoFocus={editandoOferta}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void guardarPrecioOferta(); } if (e.key === "Escape" && !p.oferta) cancelarOferta(); }} />
            </label>
            <button type="button" className="btn guardar-of" disabled={guardando || !ofertaCambiada} onClick={() => void guardarPrecioOferta()}>Guardar</button>
          </div>
          <div className="row2 hint-row">
            <span className="hint-of">Precio de oferta. El precio normal se verá tachado.</span>
            {p.oferta
              ? <button type="button" className="link-of" disabled={guardando} onClick={quitarOferta}>Quitar oferta</button>
              : <button type="button" className="link-of" onClick={cancelarOferta}>Cancelar</button>}
          </div>
          {/* «Antes» manual solo para productos que ya lo tenían; con precio de oferta no hace falta */}
          {!p.precioOferta && !!p.antes && (
            <>
              <label className="money">$
                <input type="number" min={0} step={1} inputMode="numeric" aria-label="Precio anterior" value={antes}
                  onChange={(e) => setAntes(e.target.value)} onBlur={guardarAntes}
                  onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
              </label>
              <span className="hint-of">Precio anterior (tachado)</span>
            </>
          )}
        </div>
      )}
      <button type="button" className="danger" onClick={() => void borrar()}>🗑 Eliminar producto</button>
    </article>
  );
}

export { mensaje };
