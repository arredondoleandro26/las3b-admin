/**
 * Genera y guarda en el deployment de Convex las variables que necesita Convex Auth:
 * JWT_PRIVATE_KEY (clave privada RS256 en PKCS8) y JWKS (clave pública).
 * Equivale a lo que hace `npx @convex-dev/auth`, pero sin preguntas interactivas.
 *
 * Uso:   node scripts/generar-llaves-auth.mjs            (deployment de desarrollo, según .env.local)
 *        node scripts/generar-llaves-auth.mjs --prod     (deployment de producción)
 */
import { exportJWK, exportPKCS8, generateKeyPair } from "jose";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const prod = process.argv.includes("--prod");
// Se invoca la CLI de Convex directamente con node (sin shell) para que las llaves con espacios y comillas lleguen intactas.
const convexCli = fileURLToPath(new URL("../node_modules/convex/bin/main.js", import.meta.url));
const keys = await generateKeyPair("RS256", { extractable: true });
const privateKey = (await exportPKCS8(keys.privateKey)).trimEnd().replace(/\n/g, " ");
const publicKey = await exportJWK(keys.publicKey);
const jwks = JSON.stringify({ keys: [{ use: "sig", ...publicKey }] });

function set(nombre, valor) {
  const args = [convexCli, "env", "set", ...(prod ? ["--prod"] : []), nombre, "--", valor];
  const r = spawnSync(process.execPath, args, { stdio: ["ignore", "inherit", "pipe"], encoding: "utf8" });
  const err = (r.stderr || "").split("\n").filter((l) => l && !l.includes("Assertion failed")).join("\n");
  if (err) console.error(err);
  if (r.status !== 0 && !/Successfully set/.test(err)) throw new Error(`No se pudo guardar ${nombre}`);
}

set("JWT_PRIVATE_KEY", privateKey);
set("JWKS", jwks);
console.log(`✔ Llaves de Convex Auth guardadas en el deployment ${prod ? "de producción" : "de desarrollo"}.`);
