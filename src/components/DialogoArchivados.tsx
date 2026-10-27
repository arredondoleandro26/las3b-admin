import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import { ESTADOS, fechaCorta, fmt, norm } from "../lib/formato";
import { Modal } from "./Modal";
import { mensaje } from "./TarjetaEdicion";

type Props = {
  open: boolean;
  onClose: () => void;
  categorias: Doc<"categorias">[];
  /** Avisa qué se eliminó para siempre, para sacarlo también del historial de deshacer. */
  onPurgado: (ids: { productos: Id<"productos">[]; categorias: Id<"categorias">[] }) => void;
};

export function DialogoArchivados({ open, onClose, categorias, onPurgado }: Props) {
  return (
    <Modal open={open} onClose={onClose} className="arch">
      <Contenido onClose={onClose} categorias={categorias} onPurgado={onPurgado} />
    </Modal>
  );
}

const ORIGINAL = "__original";

function Contenido({ onClose, categorias, onPurgado }: Omit<Props, "open">) {
  const archivados = useQuery(api.productos.listarArchivados);
  const restaurar = useMutation(api.productos.restaurar);
  const eliminarDefinitivo = useMutation(api.productos.eliminarDefinitivo);
  const [q, setQ] = useState("");
  const [destino, setDestino] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ t: string; ok?: boolean } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const lista = useMemo(() => {
    const t = norm(q.trim());
    return (archivados ?? []).filter((a) => !t || norm(a.nombre + " " + a.catNombre).includes(t));
  }, [archivados, q]);

  type Archivado = NonNullable<typeof archivados>[number];

  async function correr(fn: () => Promise<void>) {
    setOcupado(true);
    try { await fn(); } catch (e) { setMsg({ t: mensaje(e) }); } finally { setOcupado(false); }
  }

  function volver(a: Archivado) {
    const d = destino[a._id] ?? (a.catEstado === "no-existe" ? "" : ORIGINAL);
    if (!d) return setMsg({ t: "Elige primero la categoría donde quieres restaurarlo." });
    void correr(async () => {
      await restaurar(d === ORIGINAL ? { ids: [a._id] } : { ids: [a._id], catId: d as Id<"categorias"> });
      const cat = d === ORIGINAL ? a.catNombre : categorias.find((c) => c._id === d)?.nombre;
      setMsg({ t: `↩ «${a.nombre}» volvió a «${cat}».`, ok: true });
    });
  }

  function borrar(a: Archivado) {
    if (!confirm(`¿Eliminar para siempre «${a.nombre}»?\n\nNo se podrá recuperar ni deshacer.`)) return;
    void correr(async () => {
      const r = await eliminarDefinitivo({ ids: [a._id] });
      onPurgado({ productos: [a._id], categorias: r.categorias });
      setMsg({ t: `🗑 «${a.nombre}» se eliminó para siempre.` });
    });
  }

  function vaciar() {
    const n = archivados?.length ?? 0;
    if (!n || !confirm(`¿Eliminar para siempre los ${n} producto${n === 1 ? "" : "s"} archivado${n === 1 ? "" : "s"}?\n\nNo se podrá recuperar ni deshacer.`)) return;
    const ids = archivados!.map((a) => a._id);
    void correr(async () => {
      const r = await eliminarDefinitivo({ ids });
      onPurgado({ productos: ids, categorias: r.categorias });
      setMsg({ t: `🗑 Se vació Archivados (${n}).` });
    });
  }

  const total = archivados?.length ?? 0;

  return (
    <form onSubmit={(e) => e.preventDefault()}>
      <h3>🗄️ Archivados</h3>
      <p className="arch-intro">
        Aquí quedan los productos que eliminas. Puedes <b>restaurarlos</b> a su categoría o <b>eliminarlos para siempre</b>. Los clientes no los ven.
      </p>
      <div className="archbar">
        <input type="search" placeholder="Buscar en archivados…" aria-label="Buscar en archivados" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} />
        {total > 0 && <span className="arch-count">{total} producto{total === 1 ? "" : "s"}</span>}
      </div>
      <div className="arch-list">
        {archivados === undefined && <p className="empty">Cargando…</p>}
        {archivados && !lista.length && (
          <p className="empty">{total ? "Ningún archivado coincide con la búsqueda." : "No hay productos archivados. Cuando elimines un producto, quedará aquí."}</p>
        )}
        {lista.map((a) => (
          <div className="arow" key={a._id}>
            <div className="athumb">{a.imagen ? <img src={a.imagen} alt="" loading="lazy" /> : a.icono}</div>
            <div className="ainfo">
              <b>{a.nombre}</b>
              <span>{fmt(a.precio)} c/u · {ESTADOS[a.estado]}</span>
              <small>
                De «{a.catNombre}»
                {a.catEstado === "eliminada" && " (categoría eliminada: se restaura con ella)"}
                {a.catEstado === "no-existe" && " (esa categoría ya no existe)"}
                {" · "}archivado el {fechaCorta(a.fecha)}
              </small>
            </div>
            <div className="aact">
              <select aria-label="Restaurar en la categoría" value={destino[a._id] ?? (a.catEstado === "no-existe" ? "" : ORIGINAL)}
                onChange={(e) => setDestino((d) => ({ ...d, [a._id]: e.target.value }))}>
                {a.catEstado === "no-existe"
                  ? <option value="">Elige la categoría…</option>
                  : <option value={ORIGINAL}>{a.icono} {a.catNombre} (su lugar original)</option>}
                {categorias.filter((c) => c._id !== a.catId).map((c) => <option key={c._id} value={c._id}>{c.icono} {c.nombre}</option>)}
              </select>
              <button type="button" className="btn" disabled={ocupado} onClick={() => volver(a)}>↩ Restaurar</button>
              <button type="button" className="danger" disabled={ocupado} onClick={() => borrar(a)}>🗑 Eliminar para siempre</button>
            </div>
          </div>
        ))}
      </div>
      <p className={`np-msg${msg?.ok ? " ok" : ""}`} role="alert">{msg?.t}</p>
      <menu>
        <button type="button" className="btn btn-danger" disabled={!total || ocupado} onClick={vaciar}>🗑 Vaciar archivados</button>
        <button type="button" className="btn" onClick={onClose}>Cerrar</button>
      </menu>
    </form>
  );
}
