import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import { mensaje } from "../lib/errores";
import { useToast } from "./useToast";

/**
 * Deshacer / rehacer del panel. Cada cambio ya está guardado en Convex, así que el historial no guarda
 * fotos del catálogo: guarda, por cada paso, cómo volver a hacerlo y cómo revertirlo (las mismas
 * mutaciones con los valores anteriores). Vive solo en esta pestaña: al recargar empieza vacío.
 */

export type Refs = { productos?: Id<"productos">[]; categorias?: Id<"categorias">[] };

export type Paso = {
  /** Qué se hizo, en minúsculas: «cambio de precio», «producto eliminado»… */
  etiqueta: string;
  rehacer: () => Promise<unknown>;
  deshacer: () => Promise<unknown>;
  /** Lo que toca el paso: si se elimina para siempre, el paso sale del historial. */
  refs?: Refs;
};

const MAX_PASOS = 60;

type Ctx = {
  /** Agrega un paso que ya se hizo. */
  registrar: (p: Paso) => void;
  /** Hace el paso y lo agrega al historial. */
  ejecutar: (p: Paso) => Promise<void>;
  deshacer: () => Promise<boolean>;
  rehacer: () => Promise<boolean>;
  puedeDeshacer: boolean;
  puedeRehacer: boolean;
  /** Pasos disponibles para deshacer. */
  pasos: number;
  /** Aviso con botón «Deshacer» para el último paso registrado (p. ej. justo después de eliminar). */
  avisoDeshacer: (msg: string) => void;
  /** Saca del historial los pasos que tocan algo que ya no existe. */
  purgar: (refs: Refs) => void;
  limpiar: () => void;
};

const HistorialCtx = createContext<Ctx | null>(null);

export function HistorialProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const lista = useRef<Paso[]>([]);
  const indice = useRef(0); // pasos aplicados: lista[0..indice-1]
  const cola = useRef<Promise<unknown>>(Promise.resolve());
  const [, setVersion] = useState(0);
  const refrescar = () => setVersion((v) => v + 1);

  // Los pasos se aplican de a uno, aunque se aprieten varios Ctrl+Z seguidos.
  const enCola = useCallback(<T,>(fn: () => Promise<T>) => {
    const r = cola.current.then(fn, fn);
    cola.current = r.catch(() => {});
    return r;
  }, []);

  const registrar = useCallback((p: Paso) => {
    lista.current = [...lista.current.slice(0, indice.current), p].slice(-MAX_PASOS);
    indice.current = lista.current.length;
    refrescar();
  }, []);

  const ejecutar = useCallback(async (p: Paso) => {
    await p.rehacer();
    registrar(p);
  }, [registrar]);

  const mover = useCallback((dir: -1 | 1) => enCola(async () => {
    const i = dir < 0 ? indice.current - 1 : indice.current;
    const p = lista.current[i];
    if (!p) return false;
    try {
      await (dir < 0 ? p.deshacer() : p.rehacer());
      indice.current = dir < 0 ? i : i + 1;
      toast(`${dir < 0 ? "↶ Se deshizo" : "↷ Se rehízo"}: ${p.etiqueta}`);
    } catch (e) {
      // ya no se puede aplicar (otro administrador lo cambió o se eliminó para siempre): se descarta
      lista.current = lista.current.filter((x) => x !== p);
      if (dir < 0) indice.current = i;
      toast(`No se pudo ${dir < 0 ? "deshacer" : "rehacer"} «${p.etiqueta}»: ${mensaje(e)}`, 5000);
    }
    refrescar();
    return true;
  }), [enCola, toast]);

  const deshacer = useCallback(() => mover(-1), [mover]);
  const rehacer = useCallback(() => mover(1), [mover]);

  const avisoDeshacer = useCallback((msg: string) => {
    const paso = lista.current[indice.current - 1];
    toast(msg, 9000, {
      label: "↶ Deshacer",
      fn: () => {
        if (lista.current[indice.current - 1] === paso) void deshacer();
        else toast("Ya hiciste otros cambios después. Usa «↶ Deshacer» de la barra para ir paso a paso.", 4500);
      },
    });
  }, [toast, deshacer]);

  const purgar = useCallback((refs: Refs) => {
    const fuera = new Set<string>([...(refs.productos ?? []), ...(refs.categorias ?? [])]);
    const toca = (p: Paso) => [...(p.refs?.productos ?? []), ...(p.refs?.categorias ?? [])].some((id) => fuera.has(id));
    const antes = lista.current.slice(0, indice.current).filter((p) => !toca(p));
    const despues = lista.current.slice(indice.current).filter((p) => !toca(p));
    lista.current = [...antes, ...despues];
    indice.current = antes.length;
    refrescar();
  }, []);

  const limpiar = useCallback(() => { lista.current = []; indice.current = 0; refrescar(); }, []);

  const value: Ctx = {
    registrar, ejecutar, deshacer, rehacer, avisoDeshacer, purgar, limpiar,
    puedeDeshacer: indice.current > 0,
    puedeRehacer: indice.current < lista.current.length,
    pasos: indice.current,
  };
  return <HistorialCtx.Provider value={value}>{children}</HistorialCtx.Provider>;
}

export function useHistorial() {
  const h = useContext(HistorialCtx);
  if (!h) throw new Error("useHistorial fuera de HistorialProvider");
  return h;
}
