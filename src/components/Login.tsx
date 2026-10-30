import { useState, type FormEvent } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { ConvexError } from "convex/values";
import { CargandoBurbujas } from "./CargandoBurbujas";

export function Login() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setOcupado(true);
    const fd = new FormData(e.currentTarget);
    fd.set("flow", flow);
    try {
      await signIn("password", fd);
    } catch (err) {
      const msg = err instanceof ConvexError ? String(err.data) : "";
      setError(msg || (flow === "signIn" ? "Correo o contraseña incorrectos." : "No se pudo crear la cuenta. Revisa que el correo esté autorizado."));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="login">
      <form onSubmit={enviar}>
        {ocupado && <CargandoBurbujas texto={flow === "signIn" ? "Entrando…" : "Creando cuenta…"} />}
        <h1>🫧 Administración del catálogo</h1>
        <p style={{ margin: 0, color: "var(--muted)", fontSize: ".88rem" }}>
          {flow === "signIn" ? "Ingresa con tu correo y contraseña." : "Crea tu cuenta de administrador (solo correos autorizados)."}
        </p>
        <label>Correo<input name="email" type="email" autoComplete="email" required /></label>
        <label>Contraseña<input name="password" type="password" autoComplete={flow === "signIn" ? "current-password" : "new-password"} required minLength={8} /></label>
        <p className="err" role="alert">{error}</p>
        <button className="btn primary" disabled={ocupado}>{ocupado ? "Un momento…" : flow === "signIn" ? "Entrar" : "Crear cuenta"}</button>
        <button type="button" className="alt" onClick={() => { setFlow(flow === "signIn" ? "signUp" : "signIn"); setError(""); }}>
          {flow === "signIn" ? "Primera vez: crear cuenta de administrador" : "Ya tengo cuenta: entrar"}
        </button>
      </form>
    </div>
  );
}
