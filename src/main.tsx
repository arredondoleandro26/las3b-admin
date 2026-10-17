import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import App from "./App";
import { ToastProvider } from "./hooks/useToast";
import "./styles.css";

const url = import.meta.env.VITE_CONVEX_URL as string | undefined;
if (!url) {
  document.getElementById("root")!.innerHTML =
    '<p style="padding:30px;font-family:sans-serif">Falta la variable <code>VITE_CONVEX_URL</code>. Ejecuta <code>npx convex dev</code> o configúrala en el hosting.</p>';
} else {
  const convex = new ConvexReactClient(url);
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ConvexAuthProvider client={convex}>
        <ToastProvider>
          <App />
        </ToastProvider>
      </ConvexAuthProvider>
    </StrictMode>,
  );
}
