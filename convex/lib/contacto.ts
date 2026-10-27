/**
 * Validación del formulario «Contáctanos». Funciones puras: el catálogo usa una copia idéntica
 * (las3b-catalogo/src/lib/contacto.ts) para avisar en el navegador; aquí se repite en el servidor
 * porque cualquiera puede llamar a `contacto.enviar` sin pasar por el formulario.
 * Si cambias una regla, cámbiala en los dos archivos.
 */

export const LIMITES = { nombre: 80, telefono: 20, correo: 100, mensaje: 1000 } as const;

export type DatosContacto = { nombre: string; telefono: string; correo: string; mensaje: string };
export type ErroresContacto = Partial<Record<keyof DatosContacto, string>>;

/** 9 1234 5678 / 56912345678 / +56 9 1234 5678 → «+56 9 1234 5678». Otros países: «+» y dígitos. null si no es válido. */
export function telefonoValido(tel: string): string | null {
  const dig = tel.replace(/\D/g, "");
  if (/^[2-9]\d{8}$/.test(dig)) return `+56 ${dig[0]} ${dig.slice(1, 5)} ${dig.slice(5)}`;
  if (/^56[2-9]\d{8}$/.test(dig)) return `+56 ${dig[2]} ${dig.slice(3, 7)} ${dig.slice(7)}`;
  return tel.trim().startsWith("+") && dig.length >= 8 && dig.length <= 15 ? "+" + dig : null;
}

/** Datos limpios y los errores por campo (vacío si todo está bien). */
export function validarContacto(d: DatosContacto): { datos: DatosContacto; errores: ErroresContacto } {
  const nombre = d.nombre.trim().replace(/\s+/g, " ").slice(0, LIMITES.nombre);
  const telefono = d.telefono.trim().slice(0, LIMITES.telefono);
  const correo = d.correo.trim().toLowerCase().slice(0, LIMITES.correo);
  const mensaje = d.mensaje.trim().slice(0, LIMITES.mensaje);
  const tel = telefonoValido(telefono);
  const errores: ErroresContacto = {};

  if (!nombre) errores.nombre = "Escribe tu nombre.";
  else if (/\d/.test(nombre) || nombre.replace(/[^\p{L}]/gu, "").length < 2) errores.nombre = "Escribe un nombre válido.";
  if (!telefono) errores.telefono = "Escribe tu teléfono.";
  else if (!tel) errores.telefono = "Número no válido: usa 9 dígitos (ej: 9 1234 5678).";
  if (!correo) errores.correo = "Escribe tu correo electrónico.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo)) errores.correo = "Correo no válido (ej: nombre@correo.cl).";
  if (!mensaje) errores.mensaje = "Escribe tu mensaje.";
  else if (mensaje.length < 5) errores.mensaje = "Cuéntanos un poco más.";

  return { datos: { nombre, telefono: tel ?? telefono, correo, mensaje }, errores };
}

export type CampoContacto = "telefono" | "correo" | "instagram" | "facebook" | "direccion" | "horario";

/** Datos de contacto del catálogo HTML antiguo (meta.contacto); su «envioUrl» ya no se usa. */
export function contactoImportado(c: Partial<Record<CampoContacto, string>> | undefined) {
  if (!c) return undefined;
  const g = (k: CampoContacto) => String(c[k] ?? "").trim();
  return { telefono: g("telefono"), correo: g("correo"), instagram: g("instagram"), facebook: g("facebook"), direccion: g("direccion"), horario: g("horario") };
}
