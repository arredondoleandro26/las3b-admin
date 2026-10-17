import { ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";

/** Correos autorizados a administrar, separados por coma en la variable de entorno ADMIN_EMAILS. */
export function correosAdmin(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function esCorreoAdmin(email: string | undefined | null): boolean {
  if (!email) return false;
  const lista = correosAdmin();
  // Sin lista configurada no se permite a nadie: evita dejar el panel abierto por accidente.
  if (!lista.length) return false;
  return lista.includes(email.trim().toLowerCase());
}

/**
 * Exige un usuario autenticado cuyo correo esté en la lista de administradores.
 * Se usa al inicio de TODAS las mutaciones y de las queries privadas del panel.
 */
export async function requerirAdmin(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new ConvexError("Debes iniciar sesión.");
  const usuario = await ctx.db.get(userId);
  if (!usuario || !esCorreoAdmin(usuario.email)) {
    throw new ConvexError("Tu cuenta no tiene permisos de administración.");
  }
  return usuario;
}
