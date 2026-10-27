/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ajustes from "../ajustes.js";
import type * as archivos from "../archivos.js";
import type * as auth from "../auth.js";
import type * as catalogo from "../catalogo.js";
import type * as categorias from "../categorias.js";
import type * as contacto from "../contacto.js";
import type * as crons from "../crons.js";
import type * as http from "../http.js";
import type * as importar from "../importar.js";
import type * as lib_acceso from "../lib/acceso.js";
import type * as lib_archivo from "../lib/archivo.js";
import type * as lib_contacto from "../lib/contacto.js";
import type * as lib_validadores from "../lib/validadores.js";
import type * as notificaciones from "../notificaciones.js";
import type * as productos from "../productos.js";
import type * as solicitudes from "../solicitudes.js";
import type * as usuario from "../usuario.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ajustes: typeof ajustes;
  archivos: typeof archivos;
  auth: typeof auth;
  catalogo: typeof catalogo;
  categorias: typeof categorias;
  contacto: typeof contacto;
  crons: typeof crons;
  http: typeof http;
  importar: typeof importar;
  "lib/acceso": typeof lib_acceso;
  "lib/archivo": typeof lib_archivo;
  "lib/contacto": typeof lib_contacto;
  "lib/validadores": typeof lib_validadores;
  notificaciones: typeof notificaciones;
  productos: typeof productos;
  solicitudes: typeof solicitudes;
  usuario: typeof usuario;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
};
