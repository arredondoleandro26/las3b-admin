import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requerirAdmin } from "./lib/acceso";
import { estadoSolicitudValidator } from "./lib/validadores";

/** Bandeja de solicitudes de contacto para el panel, de la más reciente a la más antigua. */
export const listar = query({
  args: {},
  handler: async (ctx) => {
    await requerirAdmin(ctx);
    return await ctx.db.query("solicitudes").order("desc").collect();
  },
});

/** Cuántas solicitudes faltan por leer (para el contador de la pestaña). */
export const contarNuevas = query({
  args: {},
  handler: async (ctx) => {
    await requerirAdmin(ctx);
    return (await ctx.db.query("solicitudes").withIndex("por_estado", (q) => q.eq("estado", "nueva")).collect()).length;
  },
});

export const marcar = mutation({
  args: { id: v.id("solicitudes"), estado: estadoSolicitudValidator },
  handler: async (ctx, { id, estado }) => {
    await requerirAdmin(ctx);
    if (await ctx.db.get(id)) await ctx.db.patch(id, { estado });
  },
});

export const eliminar = mutation({
  args: { id: v.id("solicitudes") },
  handler: async (ctx, { id }) => {
    await requerirAdmin(ctx);
    if (await ctx.db.get(id)) await ctx.db.delete(id);
  },
});
