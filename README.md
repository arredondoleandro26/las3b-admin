# las3b-admin — Panel de administración del catálogo

Panel privado para administrar el catálogo de precios de **Jabonería Las 3B**: productos, categorías, imágenes, ofertas y ajustes del negocio. Es el **único** repo con permisos de escritura; el catálogo público ([las3b-catalogo](https://github.com/arredondoleandro26/las3b-catalogo)) solo lee.

Stack: React 19 + Vite + TypeScript, [Convex](https://convex.dev) (base de datos, backend y almacenamiento de imágenes) y [Convex Auth](https://labs.convex.dev/auth) (correo + contraseña).

## Estructura

```
convex/                 Backend (este deployment lo comparten ambos repos)
  schema.ts             Tablas: ajustes, categorias, productos (+ tablas de auth)
  auth.ts               Convex Auth con proveedor Password y registro cerrado por lista de correos
  lib/acceso.ts         requerirAdmin(): toda mutación lo llama primero
  catalogo.ts           Query PÚBLICA (la consume el catálogo)
  productos.ts          CRUD, reordenar, mover de categoría, imágenes
  categorias.ts         CRUD y orden de categorías
  ajustes.ts            Datos del negocio y banner
  archivos.ts           URL de subida al storage de Convex
  importar.ts           Carga masiva desde el catálogo HTML antiguo
src/                    Frontend del panel
```

## Puesta en marcha

1. Instalar dependencias:
   ```bash
   npm install
   ```
2. Crear el proyecto en Convex (pide iniciar sesión en el navegador la primera vez). Esto genera `.env.local` con `CONVEX_DEPLOYMENT` y `VITE_CONVEX_URL`, y regenera `convex/_generated`:
   ```bash
   npx convex dev
   ```
3. Configurar variables de entorno **en el dashboard de Convex** (Settings → Environment Variables):
   | Variable | Valor |
   |---|---|
   | `ADMIN_EMAILS` | Correos autorizados, separados por coma. Ej: `dueno@gmail.com,ayudante@gmail.com` |
   | `SITE_URL` | URL del panel (en desarrollo `http://localhost:5174`) |
   | `JWT_PRIVATE_KEY` y `JWKS` | Las genera `npx @convex-dev/auth` (ver paso 4) |
4. Inicializar Convex Auth (crea las llaves JWT y configura `SITE_URL`):
   ```bash
   npx @convex-dev/auth
   ```
5. Levantar todo:
   ```bash
   npm run dev
   ```
6. Abrir el panel, pulsar **"Primera vez: crear cuenta de administrador"** con uno de los correos de `ADMIN_EMAILS`.
7. Pulsar **📥 Importar** y elegir el archivo `Catalogo Octubre 2026.html` para traer categorías, productos, imágenes y ajustes.

## Despliegue

- **Backend:** `npx convex deploy` crea/actualiza el deployment de producción. Configura allí las mismas variables (`ADMIN_EMAILS`, `SITE_URL` con la URL pública del panel, llaves JWT).
- **Frontend:** Vercel o Netlify con build `npm run build` y salida `dist/`. Variable `VITE_CONVEX_URL` = URL del deployment de producción. El `vercel.json` incluido redirige todas las rutas a `index.html`.
- La URL del deployment de producción también se usa en el repo del catálogo (`VITE_CONVEX_URL`).

## Seguridad

- El registro está cerrado: `convex/auth.ts` rechaza cualquier correo que no esté en `ADMIN_EMAILS`.
- Todas las mutaciones y las queries privadas llaman a `requerirAdmin()`; si la sesión no es de un administrador, fallan.
- La única función sin sesión es `catalogo.obtener`, que devuelve datos de lectura y nunca ids de storage.

## Imágenes

Las fotos se reducen a 420 px y se comprimen a JPEG en el navegador antes de subirse (opcionalmente se les quita el fondo), así que pesan ~10 KB cada una. Se guardan en **Convex File Storage** (plan gratuito: 1 GB almacenado, 1 GB/mes de descarga). Si el tráfico del catálogo supera ese límite, basta con activar el plan Starter de Convex (pago por uso) o cambiar `src/lib/subir.ts` + `convex/archivos.ts` por otro proveedor (UploadThing, Cloudflare R2).
