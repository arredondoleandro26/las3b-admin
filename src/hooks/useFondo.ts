import { useCallback, useState } from "react";
import type { OpcionesFondo } from "../lib/imagen";

const KEY = "las3b-admin:fondo";
const DEF: OpcionesFondo = { on: true, tol: 35 };

function leer(): OpcionesFondo {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null");
    if (v && typeof v.on === "boolean" && typeof v.tol === "number") return v;
  } catch {}
  return DEF;
}

/** Preferencia "quitar fondo de las fotos" (sí/no + sensibilidad), recordada en este navegador. */
export function useFondo() {
  const [fondo, setFondoState] = useState<OpcionesFondo>(leer);
  const setFondo = useCallback((patch: Partial<OpcionesFondo>) => {
    setFondoState((prev) => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);
  return [fondo, setFondo] as const;
}
