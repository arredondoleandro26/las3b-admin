import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import { MENSAJE_FONDO_FALLO, procesarProducto, type OpcionesFondo } from "../lib/imagen";
import { useSubirArchivo } from "../lib/subir";
import { Modal } from "./Modal";
import { TarjetaVista } from "./TarjetaVista";
import { mensaje } from "./TarjetaEdicion";
import { useToast } from "../hooks/useToast";

type Pendiente = { key: string; src: ImageBitmap; blob: Blob; url: string; removed: boolean | null };

type Props = {
  open: boolean;
  onClose: () => void;
  categorias: Doc<"categorias">[];
  catInicial: Id<"categorias"> | null;
  fondo: OpcionesFondo;
  setFondo: (p: Partial<OpcionesFondo>) => void;
};

export function DialogoNuevoProducto({ open, onClose, categorias, catInicial, fondo, setFondo }: Props) {
  return (
    <Modal open={open} onClose={onClose} className="np">
      <Formulario onClose={onClose} categorias={categorias} catInicial={catInicial} fondo={fondo} setFondo={setFondo} />
    </Modal>
  );
}

function Formulario({ onClose, categorias, catInicial, fondo, setFondo }: Omit<Props, "open">) {
  const toast = useToast();
  const crear = useMutation(api.productos.crear);
  const subir = useSubirArchivo();
  const [cat, setCat] = useState<Id<"categorias"> | "">(catInicial ?? categorias[0]?._id ?? "");
  const [nombre, setNombre] = useState("");
  const [precio, setPrecio] = useState("");
  const [pend, setPend] = useState<Pendiente[]>([]);
  const [msg, setMsg] = useState<{ t: string; ok?: boolean }>({ t: "" });
  const [ocupado, setOcupado] = useState(false);
  const [drag, setDrag] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const nombreRef = useRef<HTMLInputElement>(null);
  const pendRef = useRef(pend);
  pendRef.current = pend;

  useEffect(() => { nombreRef.current?.focus(); }, []);
  // al cerrar se liberan bitmaps y blob URLs
  useEffect(() => () => { pendRef.current.forEach((p) => { p.src.close(); URL.revokeObjectURL(p.url); }); }, []);

  async function agregarArchivos(files: FileList | File[]) {
    const imgs = [...files].filter((f) => f.type.startsWith("image/"));
    if (!imgs.length) return setMsg({ t: "Ese archivo no es una imagen." });
    setMsg({ t: "" });
    let fallo = 0;
    const nuevos: Pendiente[] = [];
    for (const f of imgs) {
      try {
        const src = await createImageBitmap(f);
        const r = await procesarProducto(src, fondo);
        if (r.removed === false) fallo++;
        nuevos.push({ key: Math.random().toString(36).slice(2), src, blob: r.blob, url: URL.createObjectURL(r.blob), removed: r.removed });
      } catch (e) { console.error(e); setMsg({ t: "No se pudo leer una de las imágenes." }); }
    }
    setPend((p) => [...p, ...nuevos]);
    if (fallo) setMsg({ t: MENSAJE_FONDO_FALLO });
  }

  // Reprocesa las fotos ya cargadas cuando cambia la opción de fondo
  const primera = useRef(true);
  useEffect(() => {
    if (primera.current) { primera.current = false; return; }
    const t = setTimeout(async () => {
      let fallo = 0;
      const nuevo: Pendiente[] = [];
      for (const p of pendRef.current) {
        const r = await procesarProducto(p.src, fondo);
        if (r.removed === false) fallo++;
        URL.revokeObjectURL(p.url);
        nuevo.push({ ...p, blob: r.blob, url: URL.createObjectURL(r.blob), removed: r.removed });
      }
      setPend(nuevo);
      setMsg({ t: fallo && fondo.on ? MENSAJE_FONDO_FALLO : "" });
    }, 180);
    return () => clearTimeout(t);
  }, [fondo]);

  function quitar(i: number) {
    setPend((p) => { const q = [...p]; const [x] = q.splice(i, 1); if (x) { x.src.close(); URL.revokeObjectURL(x.url); } return q; });
  }

  function onDrop(e: DragEvent) { e.preventDefault(); setDrag(false); void agregarArchivos(e.dataTransfer.files); }
  function onPaste(e: ClipboardEvent) {
    const fs = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith("image/"));
    if (fs.length) { e.preventDefault(); void agregarArchivos(fs); }
  }

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const otro = (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "more";
    const c = categorias.find((x) => x._id === cat);
    if (!c) return setMsg({ t: "Elige una categoría." });
    const n = nombre.trim(), pr = parseInt(precio, 10);
    if (!n) { nombreRef.current?.focus(); return setMsg({ t: "Escribe el nombre del producto." }); }
    if (!(pr >= 0)) return setMsg({ t: "Escribe el precio (solo números)." });
    setOcupado(true);
    try {
      const ids: Id<"_storage">[] = [];
      for (const p of pend) ids.push(await subir(p.blob));
      await crear({ catId: c._id, nombre: n, precio: pr, imagenes: ids });
      pend.forEach((p) => { p.src.close(); URL.revokeObjectURL(p.url); });
      setPend([]);
      if (otro) {
        setNombre(""); setPrecio(""); nombreRef.current?.focus();
        setMsg({ t: `✅ «${n}» agregado a ${c.nombre}. Puedes crear otro.`, ok: true });
      } else {
        toast(`✅ «${n}» agregado a ${c.nombre}`);
        onClose();
      }
    } catch (er) { setMsg({ t: mensaje(er) }); }
    finally { setOcupado(false); }
  }

  const catSel = categorias.find((x) => x._id === cat);

  return (
    <form onSubmit={enviar} onPaste={onPaste}>
      <h3>＋ Agregar producto nuevo</h3>
      <div className="np-fields">
        <label>Categoría
          <select value={cat} onChange={(e) => setCat(e.target.value as Id<"categorias">)} required>
            {categorias.map((c) => <option key={c._id} value={c._id}>{c.icono} {c.nombre}</option>)}
          </select>
        </label>
        <label>Nombre del producto
          <input ref={nombreRef} value={nombre} onChange={(e) => setNombre(e.target.value)} required maxLength={160} autoComplete="off" placeholder="Ej: Esponja lisa" />
        </label>
        <label>Precio ($)
          <input type="number" min={0} step={10} inputMode="numeric" required placeholder="Ej: 1500" value={precio} onChange={(e) => setPrecio(e.target.value)} />
        </label>
        <div>
          <div className="lbl">Imagen del producto</div>
          <div className={`thumbs${drag ? " drag" : ""}`}
            onDragOver={(e) => { if ([...e.dataTransfer.types].includes("Files")) { e.preventDefault(); setDrag(true); } }}
            onDragLeave={() => setDrag(false)} onDrop={onDrop}>
            {pend.map((p, i) => (
              <div key={p.key} className="thumb">
                <img src={p.url} alt="" />
                <button type="button" className="x" title="Quitar imagen" aria-label="Quitar imagen" onClick={() => quitar(i)}>✕</button>
              </div>
            ))}
            <button type="button" className="addimg" onClick={() => { if (picker.current) { picker.current.value = ""; picker.current.click(); } }}><span>＋</span>Imagen</button>
            <div className="hint">…o arrastra aquí / pega (Ctrl+V) una imagen</div>
          </div>
          <input ref={picker} type="file" accept="image/*" multiple hidden onChange={(e) => { if (e.target.files?.length) void agregarArchivos(e.target.files); }} />
        </div>
        <div className="bgopt">
          <label className="chk2"><input type="checkbox" checked={fondo.on} onChange={(e) => setFondo({ on: e.target.checked })} /> 🪄 Quitar el fondo de la foto (dejar solo el producto)</label>
          {fondo.on && (
            <div className="bgtol"><span>Menos</span><input type="range" min={10} max={90} step={5} value={fondo.tol} onChange={(e) => setFondo({ tol: +e.target.value })} aria-label="Sensibilidad para quitar el fondo" /><span>Más</span></div>
          )}
          <small>Funciona mejor con fondo liso (pared, mesa, papel). Si queda fondo, sube la sensibilidad; si se come parte del producto, bájala.</small>
        </div>
      </div>
      <div className="np-prev" aria-hidden="true">
        <div className="lbl">Así se verá</div>
        <TarjetaVista p={{ nombre: nombre.trim() || "Nombre del producto", precio: parseInt(precio, 10) || 0, estado: "disponible", imagenes: pend.map((p) => p.url), icono: catSel?.icono ?? "🛍️" }} />
      </div>
      <p className={`np-msg${msg.ok ? " ok" : ""}`} role="alert">{msg.t}</p>
      <menu>
        <button className="btn" value="ok" disabled={ocupado} style={{ background: "var(--brand)", color: "#fff" }}>{ocupado ? "Guardando…" : "Agregar producto"}</button>
        <button className="btn" value="more" disabled={ocupado}>Agregar y crear otro</button>
        <button type="button" className="btn" onClick={onClose}>Cancelar</button>
      </menu>
    </form>
  );
}
