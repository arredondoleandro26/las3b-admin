import { useMutation } from "convex/react";
import { useCallback } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

/**
 * Sube un Blob al storage de Convex: pide una URL temporal (mutación protegida) y hace POST ahí.
 * Devuelve el storageId para asociarlo a un producto / banner.
 */
export function useSubirArchivo() {
  const generarUrl = useMutation(api.archivos.generarUrlSubida);
  return useCallback(
    async (blob: Blob): Promise<Id<"_storage">> => {
      const url = await generarUrl();
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": blob.type || "application/octet-stream" }, body: blob });
      if (!res.ok) throw new Error(`Error al subir la imagen (${res.status}).`);
      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
      return storageId;
    },
    [generarUrl],
  );
}

/** Ejecuta tareas con un máximo de `limite` en paralelo. */
export async function enParalelo<T, R>(items: T[], limite: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limite, items.length) }, worker));
  return out;
}
