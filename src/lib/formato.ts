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
