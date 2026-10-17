import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { ConvexError } from "convex/values";
import { esCorreoAdmin } from "./lib/acceso";

/**
 * Auth con correo + contraseña (Convex Auth).
 * El registro queda cerrado: solo pueden crear cuenta los correos listados en ADMIN_EMAILS.
 */
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      profile(params) {
        const email = String(params.email ?? "").trim().toLowerCase();
        if (!esCorreoAdmin(email)) {
          throw new ConvexError("Este correo no está autorizado para administrar el catálogo.");
        }
        return { email };
      },
      validatePasswordRequirements(password: string) {
        if (password.length < 8) {
          throw new ConvexError("La contraseña debe tener al menos 8 caracteres.");
        }
      },
    }),
  ],
});
