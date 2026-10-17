import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { esCorreoAdmin } from "./lib/acceso";

/** Datos del usuario conectado y si tiene permisos de administración. */
export const actual = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const u = await ctx.db.get(userId);
    if (!u) return null;
    return { email: u.email ?? "", esAdmin: esCorreoAdmin(u.email) };
  },
});
