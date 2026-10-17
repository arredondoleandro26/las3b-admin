import { useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import { Modal } from "./Modal";
import { mensaje } from "./TarjetaEdicion";
import { useToast } from "../hooks/useToast";

type Props = {
  open: boolean;
  onClose: () => void;
  categorias: Doc<"categorias">[];
  productos: Doc<"productos">[];
  ids: Id<"productos">[];
  onMovidos: () => void;
};

export function DialogoMover({ open, onClose, categorias, productos, ids, onMovidos }: Props) {
  return (
    <Modal open={open} onClose={onClose} className="nc">
      <Formulario onClose={onClose} categorias={categorias} productos={productos} ids={ids} onMovidos={onMovidos} />
    </Modal>
  );
}

function Formulario({ onClose, categorias, productos, ids, onMovidos }: Omit<Props, "open">) {
  const toast = useToast();
  const mover = useMutation(api.productos.moverCategoria);
  const crearCat = useMutation(api.categorias.crear);
  const [destino, setDestino] = useState<string>(categorias[0]?._id ?? "nueva");
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoIcono, setNuevoIcono] = useState("🛍️");
  const [msg, setMsg] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const seleccion = productos.filter((p) => ids.includes(p._id));
  const catsOrigen = [...new Set(seleccion.map((p) => p.catId))];
  const info = seleccion.length === 1
    ? `Vas a mover «${seleccion[0].nombre}».`
    : `Vas a mover ${seleccion.length} productos${catsOrigen.length > 1 ? ` de ${catsOrigen.length} categorías distintas` : ""}.`;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setOcupado(true);
    try {
      let catId: Id<"categorias">;
      if (destino === "nueva") {
        const n = nuevoNombre.trim().toUpperCase();
        if (!n) { setOcupado(false); return setMsg("Escribe el nombre de la categoría nueva."); }
        catId = await crearCat({ nombre: n, icono: nuevoIcono.trim() || "🛍️" });
      } else catId = destino as Id<"categorias">;
      const n = await mover({ ids, catId });
      const c = categorias.find((x) => x._id === catId);
      toast(n ? `✅ ${n} producto${n === 1 ? "" : "s"} movido${n === 1 ? "" : "s"} a ${c?.nombre ?? nuevoNombre.toUpperCase()}` : "Los productos ya estaban en esa categoría.");
      onMovidos();
      onClose();
    } catch (er) { setMsg(mensaje(er)); }
    finally { setOcupado(false); }
  }

  return (
    <form onSubmit={enviar}>
      <h3>↔ Mover productos de categoría</h3>
      <p style={{ margin: 0, color: "var(--muted)" }}>{info}</p>
      <label>Categoría de destino
        <select value={destino} onChange={(e) => setDestino(e.target.value)} required>
          {categorias.map((c) => <option key={c._id} value={c._id}>{c.icono} {c.nombre}</option>)}
          <option value="nueva">＋ Crear una categoría nueva…</option>
        </select>
      </label>
      {destino === "nueva" && (
        <div className="np-fields">
          <label>Nombre de la categoría nueva<input value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} maxLength={80} autoComplete="off" placeholder="Ej: JUGUETES" /></label>
          <label>Ícono<input value={nuevoIcono} onChange={(e) => setNuevoIcono(e.target.value)} maxLength={8} style={{ width: 120 }} /></label>
        </div>
      )}
      <p className="np-msg" role="alert">{msg}</p>
      <menu>
        <button className="btn" disabled={ocupado} style={{ background: "var(--brand)", color: "#fff" }}>Mover</button>
        <button type="button" className="btn" onClick={onClose}>Cancelar</button>
      </menu>
    </form>
  );
}
