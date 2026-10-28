import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import { fechaHora } from "../lib/formato";
import { mensaje } from "../lib/errores";
import { useToast } from "../hooks/useToast";
import { useConfirmar } from "../hooks/useConfirmar";

type Estado = Doc<"solicitudes">["estado"];
type Filtro = Estado | "todas";

const ESTADOS: Record<Estado, string> = { nueva: "Nueva", leida: "Leída", respondida: "Respondida" };
const FILTROS: [Filtro, string][] = [["todas", "Todas"], ["nueva", "Nuevas"], ["leida", "Leídas"], ["respondida", "Respondidas"]];

/** Bandeja de los mensajes que llegan desde «Contáctanos» del catálogo. */
export function PaginaSolicitudes({ negocio }: { negocio: string }) {
  const toast = useToast();
  const confirmar = useConfirmar();
  const solicitudes = useQuery(api.solicitudes.listar);
  const marcar = useMutation(api.solicitudes.marcar);
  const eliminar = useMutation(api.solicitudes.eliminar);
  const [filtro, setFiltro] = useState<Filtro>("todas");

  const lista = useMemo(() => (solicitudes ?? []).filter((s) => filtro === "todas" || s.estado === filtro), [solicitudes, filtro]);
  const cuenta = (f: Filtro) => (solicitudes ?? []).filter((s) => f === "todas" || s.estado === f).length;

  function cambiar(s: Doc<"solicitudes">, estado: Estado) {
    void marcar({ id: s._id, estado }).catch((e) => toast(mensaje(e)));
  }
  /** Al usar un medio para responder, la solicitud deja de estar «nueva». */
  const alResponder = (s: Doc<"solicitudes">) => { if (s.estado === "nueva") cambiar(s, "leida"); };

  async function borrar(s: Doc<"solicitudes">) {
    const ok = await confirmar({ titulo: `¿Eliminar la solicitud de ${s.nombre}?`, mensaje: "No se podrá recuperar.", aceptar: "🗑 Eliminar", peligro: true });
    if (!ok) return;
    void eliminar({ id: s._id }).then(() => toast("🗑 Solicitud eliminada")).catch((e) => toast(mensaje(e)));
  }

  return (
    <main className="wrap solicitudes">
      <div className="sol-head">
        <h1>📨 Solicitudes de contacto</h1>
        <p>Los mensajes que dejan los clientes en «Contáctanos» del catálogo. Llegan al instante.</p>
        <div className="sol-filtros" role="tablist" aria-label="Filtrar solicitudes">
          {FILTROS.map(([f, t]) => (
            <button key={f} type="button" role="tab" aria-selected={filtro === f} className={filtro === f ? "on" : ""} onClick={() => setFiltro(f)}>
              {t} <span>{cuenta(f)}</span>
            </button>
          ))}
        </div>
      </div>

      {solicitudes === undefined && <div className="empty">Cargando…</div>}
      {solicitudes && !lista.length && (
        <div className="empty">{solicitudes.length ? "No hay solicitudes con ese filtro." : "Aún no llegan solicitudes. Cuando alguien escriba en «Contáctanos», aparecerá aquí."}</div>
      )}

      <div className="sol-lista">
        {lista.map((s) => {
          const tel = s.telefono.replace(/\D/g, "");
          const saludo = `Hola ${s.nombre.split(" ")[0]}, te escribimos de ${negocio} por tu mensaje en nuestro catálogo.`;
          return (
            <article key={s._id} className={`sol ${s.estado}`}>
              <header>
                <b>{s.nombre}</b>
                <span className={`sol-estado ${s.estado}`}>{ESTADOS[s.estado]}</span>
                <time>{fechaHora(s._creationTime)}</time>
              </header>
              <div className="sol-datos">
                <span>📞 {s.telefono}</span>
                <span>✉️ {s.correo}</span>
              </div>
              <p className="sol-msg">{s.mensaje}</p>
              <div className="sol-acciones">
                <a className="btn wa" href={`https://wa.me/${tel}?text=${encodeURIComponent(saludo)}`} target="_blank" rel="noopener" onClick={() => alResponder(s)}>WhatsApp</a>
                <a className="btn" href={`tel:+${tel}`} onClick={() => alResponder(s)}>Llamar</a>
                <a className="btn" href={`mailto:${s.correo}?subject=${encodeURIComponent(`Tu solicitud a ${negocio}`)}&body=${encodeURIComponent(saludo + "\n\n")}`} onClick={() => alResponder(s)}>Responder por correo</a>
                <span className="grow" />
                {s.estado !== "respondida" && <button type="button" className="btn" onClick={() => cambiar(s, "respondida")}>✔ Respondida</button>}
                {s.estado === "nueva"
                  ? <button type="button" className="btn ghost" onClick={() => cambiar(s, "leida")}>Marcar leída</button>
                  : <button type="button" className="btn ghost" onClick={() => cambiar(s, "nueva")}>Marcar como nueva</button>}
                <button type="button" className="danger" onClick={() => void borrar(s)}>🗑 Eliminar</button>
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}
