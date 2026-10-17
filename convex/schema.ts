import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { estadoValidator, imagenValidator } from "./lib/validadores";

export default defineSchema({
  ...authTables,

  // Datos generales del negocio (una sola fila)
  ajustes: defineTable({
    nombre: v.string(),
    titulo: v.string(),
    periodo: v.string(),
    precioNota: v.string(),
    aviso: v.string(),
    whatsapp: v.string(),
    pie: v.string(),
    color: v.string(),
    bannerId: v.optional(v.id("_storage")),
    bannerUrl: v.optional(v.string()),
  }),

  categorias: defineTable({
    nombre: v.string(),
    icono: v.string(),
    orden: v.number(),
  }).index("por_orden", ["orden"]),

  productos: defineTable({
    catId: v.id("categorias"),
    nombre: v.string(),
    precio: v.number(),
    estado: estadoValidator,
    orden: v.number(),
    oferta: v.optional(v.boolean()),
    antes: v.optional(v.number()),
    imagenes: v.array(imagenValidator),
  }).index("por_categoria", ["catId", "orden"]),
});
