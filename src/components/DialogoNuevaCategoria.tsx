import { useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import { Modal } from "./Modal";
import { mensaje } from "./TarjetaEdicion";
import { useToast } from "../hooks/useToast";

export const EMOJIS = ["🧽", "🪣", "🧺", "🧴", "🧼", "🧻", "🧹", "🌸", "🧑‍🍳", "🩹", "🧷", "👶", "👵", "🥽", "🍽️", "🏭", "🧪", "🐜", "🚗", "🛍️", "🎁", "🧸", "🐶", "🪴", "🔧", "💡", "🧃", "🍬"];

type Props = {
  open: boolean;
  onClose: () => void;
  categorias: Doc<"categorias">[];
  /** Se llama con la categoría creada cuando el usuario elige "Crear y agregar un producto" */
  onCrearYAgregar: (catId: Id<"categorias">) => void;
};

export function DialogoNuevaCategoria({ open, onClose, categorias, onCrearYAgregar }: Props) {
  return (
    <Modal open={open} onClose={onClose} className="nc">
      <Formulario onClose={onClose} categorias={categorias} onCrearYAgregar={onCrearYAgregar} />
    </Modal>
  );
}

function Formulario({ onClose, categorias, onCrearYAgregar }: Omit<Props, "open">) {
  const toast = useToast();
  const crear = useMutation(api.categorias.crear);
  const [nombre, setNombre] = useState("");
  const [icono, setIcono] = useState("🛍️");
  const [pos, setPos] = useState<string>("fin");
  const [msg, setMsg] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const conProducto = (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "prod";
    const n = nombre.trim().toUpperCase();
    if (!n) return setMsg("Escribe el nombre de la categoría.");
    if (categorias.some((c) => c.nombre.toUpperCase() === n)) return setMsg("Ya existe una categoría con ese nombre.");
    setOcupado(true);
    try {
      const id = await crear({ nombre: n, icono: icono.trim() || "🛍️", posicion: pos === "fin" ? undefined : parseInt(pos, 10) });
      toast(`✅ Categoría “${n}” creada`);
      onClose();
      if (conProducto) onCrearYAgregar(id);
    } catch (er) { setMsg(mensaje(er)); }
    finally { setOcupado(false); }
  }

  return (
    <form onSubmit={enviar}>
      <h3>＋ Agregar categoría nueva</h3>
      <label>Nombre de la categoría
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} required maxLength={80} autoComplete="off" placeholder="Ej: JUGUETES" autoFocus />
      </label>
      <div>
        <div className="lbl">Ícono (elige uno, o escribe / pega un emoji)</div>
        <div className="emojis">
          {EMOJIS.map((e) => <button type="button" key={e} onClick={() => setIcono(e)} style={icono === e ? { borderColor: "var(--brand)", background: "var(--brand-l)" } : undefined}>{e}</button>)}
        </div>
        <input value={icono} onChange={(e) => setIcono(e.target.value)} maxLength={8} aria-label="Ícono" style={{ width: 120 }} />
      </div>
      <label>Ubicación en el catálogo
        <select value={pos} onChange={(e) => setPos(e.target.value)}>
          <option value="0">Al principio</option>
          {categorias.map((c, i) => <option key={c._id} value={String(i + 1)}>Después de {c.icono} {c.nombre}</option>)}
          <option value="fin">Al final</option>
        </select>
      </label>
      <div>
        <div className="lbl">Así se verá</div>
        <div className="cat-head" style={{ pointerEvents: "none" }}>
          <span className="cat-icon">{icono || "🛍️"}</span>
          <h2>{nombre.trim() || "NOMBRE DE LA CATEGORÍA"}</h2>
          <span className="count">0 productos</span>
        </div>
      </div>
      <p className="np-msg" role="alert">{msg}</p>
      <menu>
        <button className="btn" value="ok" disabled={ocupado} style={{ background: "var(--brand)", color: "#fff" }}>Crear categoría</button>
        <button className="btn" value="prod" disabled={ocupado}>Crear y agregar un producto</button>
        <button type="button" className="btn" onClick={onClose}>Cancelar</button>
      </menu>
    </form>
  );
}
