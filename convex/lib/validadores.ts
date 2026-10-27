import { v } from "convex/values";

export const estadoValidator = v.union(
  v.literal("disponible"),
  v.literal("sinstock"),
  v.literal("descontinuado"),
);

export const imagenValidator = v.object({
  storageId: v.id("_storage"),
  url: v.string(),
});

export const ajustesCampos = {
  nombre: v.string(),
  titulo: v.string(),
  periodo: v.string(),
  precioNota: v.string(),
  aviso: v.string(),
  whatsapp: v.string(),
  pie: v.string(),
  color: v.string(),
};

export const AJUSTES_POR_DEFECTO = {
  nombre: "Mi negocio",
  titulo: "Catálogo de productos",
  periodo: "",
  precioNota: "Precio detalle · IVA incluido",
  aviso: "",
  whatsapp: "",
  pie: "",
  color: "#0b7f80",
};
