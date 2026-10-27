/** Utilidades de formato compartidas con el catálogo público. */

export const num = (n: number) =>
  Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");

export const fmt = (n: number) => "$" + num(n);

/** Minúsculas y sin acentos, para buscar. */
export const norm = (s: string) =>
  String(s)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export const ESTADOS = {
  disponible: "Disponible",
  sinstock: "Sin stock",
  descontinuado: "Descontinuado",
} as const;

export type Estado = keyof typeof ESTADOS;

export function descargar(blob: Blob, nombre: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/** dd-mm-aaaa */
export function fechaCorta(ms: number) {
  const d = new Date(ms);
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
}

/** dd-mm-aaaa hh:mm */
export function fechaHora(ms: number) {
  const d = new Date(ms);
  return `${fechaCorta(ms)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
