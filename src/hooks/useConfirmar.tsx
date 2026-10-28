import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

export type OpcionesConfirmar = {
  titulo: string;
  mensaje?: ReactNode;
  /** Texto del botón que confirma. */
  aceptar?: string;
  cancelar?: string;
  /** Acción destructiva: botón rojo e ícono de advertencia. */
  peligro?: boolean;
};

type Pendiente = OpcionesConfirmar & { resolver: (ok: boolean) => void };
type Ctx = (o: OpcionesConfirmar) => Promise<boolean>;

const ConfirmarCtx = createContext<Ctx>(() => Promise.resolve(false));

/**
 * Alerta de confirmación centrada, con fondo oscuro y desenfocado. Reemplaza a confirm():
 *   if (!(await confirmar({ titulo: "¿Eliminar?", peligro: true }))) return;
 * Esc, «Cancelar» o un clic en el fondo responden false.
 */
export function ConfirmarProvider({ children }: { children: ReactNode }) {
  const [p, setP] = useState<Pendiente | null>(null);
  const ref = useRef<HTMLDialogElement>(null);
  const refAceptar = useRef<HTMLButtonElement>(null);
  const refCancelar = useRef<HTMLButtonElement>(null);

  const confirmar = useCallback<Ctx>((o) => new Promise<boolean>((resolver) => {
    // Si ya había una abierta, la anterior se da por cancelada.
    setP((ant) => { ant?.resolver(false); return { ...o, resolver }; });
  }), []);

  useEffect(() => {
    const d = ref.current;
    if (!d || !p) return;
    if (!d.open) d.showModal();
    // En acciones destructivas el foco queda en «Cancelar»: un Enter apurado no borra nada.
    (p.peligro ? refCancelar : refAceptar).current?.focus();
  }, [p]);

  function responder(ok: boolean) {
    p?.resolver(ok);
    setP(null);
    ref.current?.close();
  }

  return (
    <ConfirmarCtx.Provider value={confirmar}>
      {children}
      <dialog
        ref={ref}
        className={`alerta${p?.peligro ? " peligro" : ""}`}
        aria-labelledby="alerta-titulo"
        onCancel={(e) => { e.preventDefault(); responder(false); }}
        onClick={(e) => { if (e.target === e.currentTarget) responder(false); }}
      >
        {p && (
          <div className="alerta-cuerpo">
            <div className="alerta-ico" aria-hidden="true">{p.peligro ? "⚠️" : "❔"}</div>
            <h3 id="alerta-titulo">{p.titulo}</h3>
            {p.mensaje && <div className="alerta-msg">{p.mensaje}</div>}
            <menu>
              <button type="button" className="btn" ref={refCancelar} onClick={() => responder(false)}>{p.cancelar ?? "Cancelar"}</button>
              <button type="button" className={`btn ${p.peligro ? "btn-rojo" : "primary"}`} ref={refAceptar} onClick={() => responder(true)}>
                {p.aceptar ?? "Aceptar"}
              </button>
            </menu>
          </div>
        )}
      </dialog>
    </ConfirmarCtx.Provider>
  );
}

export const useConfirmar = () => useContext(ConfirmarCtx);
