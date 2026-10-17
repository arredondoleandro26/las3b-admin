import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

type Accion = { label: string; fn: () => void };
type Toast = { msg: string; accion?: Accion } | null;
type Ctx = { toast: (msg: string, ms?: number, accion?: Accion) => void };

const ToastCtx = createContext<Ctx>({ toast: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [t, setT] = useState<Toast>(null);
  const [show, setShow] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  const toast = useCallback((msg: string, ms = 2800, accion?: Accion) => {
    setT({ msg, accion });
    setShow(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setShow(false), ms);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);
  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className={`toast${show ? " show" : ""}${t?.accion ? " act" : ""}`} role="status">
        {t?.msg}
        {t?.accion && (
          <button onClick={() => { setShow(false); t.accion!.fn(); }}>{t.accion.label}</button>
        )}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx).toast;
