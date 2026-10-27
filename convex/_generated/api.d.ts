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
import type * as http from "../http.js";
import type * as importar from "../importar.js";
import type * as lib_acceso from "../lib/acceso.js";
import type * as lib_archivo from "../lib/archivo.js";
import type * as lib_validadores from "../lib/validadores.js";
import type * as productos from "../productos.js";
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
  http: typeof http;
  importar: typeof importar;
  "lib/acceso": typeof lib_acceso;
  "lib/archivo": typeof lib_archivo;
  "lib/validadores": typeof lib_validadores;
  productos: typeof productos;
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

export declare const components: {};
