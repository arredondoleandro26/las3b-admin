import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { archivadoValidator, contactoValidator, estadoSolicitudValidator, estadoValidator, imagenValidator } from "./lib/validadores";

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
    contacto: v.optional(contactoValidator),
  }),

  /** Mensajes del formulario «Contáctanos» del catálogo. Solo los lee el panel. */
  solicitudes: defineTable({
    nombre: v.string(),
    telefono: v.string(),
    correo: v.string(),
    mensaje: v.string(),
    estado: estadoSolicitudValidator,
  }).index("por_estado", ["estado"]),

  categorias: defineTable({
    nombre: v.string(),
    icono: v.string(),
    orden: v.number(),
    /** Marca de tiempo si se eliminó: queda oculta, pero se puede restaurar (deshacer o desde Archivados). */
    eliminada: v.optional(v.number()),
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
    /** Presente si el producto se eliminó: está en «Archivados» y no se muestra en ninguna parte. */
    archivado: v.optional(archivadoValidator),
  }).index("por_categoria", ["catId", "orden"]),
});
