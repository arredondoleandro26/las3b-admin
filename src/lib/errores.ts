/** Texto para mostrar de un error de Convex (ConvexError trae el mensaje en `data`) o de JS. */
export function mensaje(e: unknown): string {
  if (e && typeof e === "object" && "data" in e && typeof (e as { data: unknown }).data === "string") return (e as { data: string }).data;
  if (e instanceof Error) return e.message;
  return "Ocurrió un error inesperado.";
}
