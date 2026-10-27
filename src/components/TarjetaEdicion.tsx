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
  const actualizar = useMutation(api.productos.actualizar);
  const eliminar = useMutation(api.productos.eliminar);
  const mover = useMutation(api.productos.moverCategoria);
  const agregarImagen = useMutation(api.productos.agregarImagen);
  const reemplazarImagen = useMutation(api.productos.reemplazarImagen);
  const quitarImagen = useMutation(api.productos.quitarImagen);
  const subir = useSubirArchivo();

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: p._id, disabled: !arrastrable });

  // Campos de texto: se editan localmente y se guardan al salir del campo (o con Enter)
  const [nombre, setNombre] = useState(p.nombre);
  const [precio, setPrecio] = useState(String(p.precio));
  const [antes, setAntes] = useState(p.antes ? String(p.antes) : "");
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [drag, setDrag] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const modo = useRef<{ tipo: "add" } | { tipo: "replace"; i: number }>({ tipo: "add" });

  useEffect(() => { setNombre(p.nombre); }, [p.nombre]);
  useEffect(() => { setPrecio(String(p.precio)); }, [p.precio]);
  useEffect(() => { setAntes(p.antes ? String(p.antes) : ""); }, [p.antes]);

  type Cambios = { nombre?: string; precio?: number; estado?: Estado; oferta?: boolean; antes?: number | null };
  async function guardar(cambios: Cambios) {
    setGuardando(true);
    try { await actualizar({ id: p._id, ...cambios }); }
    catch (e) { toast(mensaje(e)); }
    finally { setGuardando(false); }
  }

  function guardarNombre() { const v = nombre.trim(); if (!v) { setNombre(p.nombre); return; } if (v !== p.nombre) void guardar({ nombre: v }); }
  function guardarPrecio() { const v = Math.max(0, parseInt(precio, 10) || 0); setPrecio(String(v)); if (v !== p.precio) void guardar({ precio: v }); }
  function guardarAntes() { const v = Math.max(0, parseInt(antes, 10) || 0); setAntes(v ? String(v) : ""); if ((v || null) !== (p.antes ?? null)) void guardar({ antes: v || null }); }

  async function procesarArchivos(files: FileList | File[]) {
    const imgs = [...files].filter((f) => f.type.startsWith("image/"));
    if (!imgs.length) return toast("Ese archivo no es una imagen.");
    setSubiendo(true);
    try {
      let fallo = false;
      for (const f of imgs) {
        const r = await procesarProducto(f, fondo);
        if (r.removed === false) fallo = true;
        const storageId = await subir(r.blob);
        const m = modo.current;
        if (m.tipo === "replace") { await reemplazarImagen({ id: p._id, indice: m.i, storageId }); modo.current = { tipo: "add" }; }
        else await agregarImagen({ id: p._id, storageId });
      }
      if (fallo) toast(MENSAJE_FONDO_FALLO, 6500);
    } catch (e) { toast(mensaje(e)); }
    finally { setSubiendo(false); }
  }

  function elegir(m: typeof modo.current) { modo.current = m; if (picker.current) { picker.current.value = ""; picker.current.click(); } }
  function onPick(e: ChangeEvent<HTMLInputElement>) { if (e.target.files?.length) void procesarArchivos(e.target.files); }
  function onDrop(e: DragEvent) { e.preventDefault(); setDrag(false); modo.current = { tipo: "add" }; void procesarArchivos(e.dataTransfer.files); }

  async function borrar() {
    if (!confirm(`¿Eliminar «${p.nombre}» del catálogo?`)) return;
    try { await eliminar({ id: p._id }); toast(`🗑 «${p.nombre}» eliminado`); } catch (e) { toast(mensaje(e)); }
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
      {guardando && <span className="guardando">Guardando…</span>}
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
          <button key={img.storageId} type="button" className={`thumb${subiendo ? " subiendo" : ""}`} title="Clic para reemplazar esta imagen" onClick={() => elegir({ tipo: "replace", i: k })}>
            <img src={img.url} alt="" />
            <span
              className="x"
              role="button"
              title="Quitar imagen"
              onClick={(e) => { e.stopPropagation(); void quitarImagen({ id: p._id, indice: k }).catch((er) => toast(mensaje(er))); }}
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
          onChange={(e) => void mover({ ids: [p._id], catId: e.target.value as Id<"categorias"> }).then(() => toast("✅ Producto movido de categoría")).catch((er) => toast(mensaje(er)))}>
          {categorias.map((c) => <option key={c._id} value={c._id}>{c.icono} {c.nombre}</option>)}
        </select>
      </label>
      <div className="row2">
        <label className="ofl">
          <input type="checkbox" checked={!!p.oferta} onChange={(e) => void guardar({ oferta: e.target.checked })} /> Oferta
        </label>
        {p.oferta && (
          <label className="money antes-l">antes $
            <input type="number" min={0} step={1} inputMode="numeric" aria-label="Precio anterior" value={antes}
              onChange={(e) => setAntes(e.target.value)} onBlur={guardarAntes}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
          </label>
        )}
      </div>
      <button type="button" className="danger" onClick={() => void borrar()}>🗑 Eliminar producto</button>
    </article>
  );
}

export function mensaje(e: unknown): string {
  if (e && typeof e === "object" && "data" in e && typeof (e as { data: unknown }).data === "string") return (e as { data: string }).data;
  if (e instanceof Error) return e.message;
  return "Ocurrió un error inesperado.";
}
