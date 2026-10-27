import { useRef, useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import { procesarBanner } from "../lib/imagen";
import { useSubirArchivo } from "../lib/subir";
import { Modal } from "./Modal";
import { mensaje } from "./TarjetaEdicion";
import { useToast } from "../hooks/useToast";
import { useHistorial } from "../hooks/useHistorial";

type Props = { open: boolean; onClose: () => void; ajustes: Doc<"ajustes"> | null };

const CAMPOS = [
  ["nombre", "Nombre del negocio", "Ej: Jabonería Las 3B"],
  ["titulo", "Título", "Ej: Catálogo de productos"],
  ["periodo", "Actualizado a", "Ej: Octubre 2026"],
  ["precioNota", "Nota de precios", "Ej: Precio detalle · IVA incluido"],
] as const;

/** Zona «Contáctanos» del catálogo. */
const CAMPOS_CONTACTO = [
  ["telefono", "Teléfono del local", "+56 9 1234 5678", "tel"],
  ["correo", "Correo electrónico", "correo@ejemplo.cl", "email"],
  ["instagram", "Instagram (@usuario o enlace)", "@mi_negocio", "text"],
  ["facebook", "Facebook (nombre de la página o enlace; con el enlace se vuelve clicable)", "https://www.facebook.com/mi.pagina", "text"],
  ["direccion", "Dirección", "Calle 123, Ciudad", "text"],
] as const;

export function DialogoAjustes({ open, onClose, ajustes }: Props) {
  return (
    <Modal open={open} onClose={onClose}>
      <Formulario onClose={onClose} ajustes={ajustes} />
    </Modal>
  );
}

function Formulario({ onClose, ajustes }: Omit<Props, "open">) {
  const toast = useToast();
  const h = useHistorial();
  const actualizar = useMutation(api.ajustes.actualizar);
  const cambiarBanner = useMutation(api.ajustes.cambiarBanner);
  const subir = useSubirArchivo();
  const [ocupado, setOcupado] = useState(false);
  const [subiendoBanner, setSubiendoBanner] = useState(false);
  const picker = useRef<HTMLInputElement>(null);

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const g = (k: string) => String(fd.get(k) ?? "").trim();
    setOcupado(true);
    try {
      const nuevos = {
        nombre: g("nombre") || "Mi negocio",
        titulo: g("titulo") || "Catálogo de productos",
        periodo: g("periodo"),
        precioNota: g("precioNota"),
        aviso: g("aviso"),
        whatsapp: g("whatsapp"),
        pie: g("pie"),
        color: g("color") || "#0b7f80",
        contacto: {
          telefono: g("c_telefono"),
          correo: g("c_correo"),
          instagram: g("c_instagram"),
          facebook: g("c_facebook"),
          direccion: g("c_direccion"),
          horario: g("c_horario").split("\n").map((l) => l.trim()).filter(Boolean).join("\n"),
        },
      };
      const previos = {
        nombre: ajustes?.nombre ?? "Mi negocio",
        titulo: ajustes?.titulo ?? "Catálogo de productos",
        periodo: ajustes?.periodo ?? "",
        precioNota: ajustes?.precioNota ?? "",
        aviso: ajustes?.aviso ?? "",
        whatsapp: ajustes?.whatsapp ?? "",
        pie: ajustes?.pie ?? "",
        color: ajustes?.color ?? "#0b7f80",
        contacto: ajustes?.contacto ?? { telefono: "", correo: "", instagram: "", facebook: "", direccion: "", horario: "" },
      };
      await h.ejecutar({ etiqueta: "cambio de ajustes", rehacer: () => actualizar(nuevos), deshacer: () => actualizar(previos) });
      toast("✅ Ajustes guardados");
      onClose();
    } catch (er) { toast(mensaje(er)); }
    finally { setOcupado(false); }
  }

  async function banner(storageId: Id<"_storage"> | null, etiqueta: string) {
    const previo = ajustes?.bannerId ?? null;
    await h.ejecutar({ etiqueta, rehacer: () => cambiarBanner({ storageId }), deshacer: () => cambiarBanner({ storageId: previo }) });
  }

  async function nuevoBanner(file: File) {
    setSubiendoBanner(true);
    try {
      const blob = await procesarBanner(file);
      const storageId = await subir(blob);
      await banner(storageId, "banner cambiado");
      toast("✅ Banner actualizado");
    } catch (er) { toast(mensaje(er)); }
    finally { setSubiendoBanner(false); }
  }

  return (
    <form onSubmit={enviar}>
      <h3>⚙️ Ajustes del catálogo</h3>
      {CAMPOS.map(([k, label, ph]) => (
        <label key={k}>{label}<input name={k} defaultValue={ajustes?.[k] ?? ""} placeholder={ph} /></label>
      ))}
      <label>Aviso<textarea name="aviso" rows={3} defaultValue={ajustes?.aviso ?? ""} /></label>
      <label>WhatsApp para recibir pedidos (código de país + número, solo dígitos)
        <input name="whatsapp" inputMode="numeric" defaultValue={ajustes?.whatsapp ?? ""} placeholder="56912345678" />
      </label>
      <label>Pie de página<textarea name="pie" rows={4} defaultValue={ajustes?.pie ?? ""} /></label>
      <fieldset className="aj-grupo">
        <legend>✉️ Zona de contacto del catálogo</legend>
        <p className="aj-nota">Las solicitudes del formulario llegan a la pestaña <b>📨 Solicitudes</b> de este panel. Lo que dejes vacío no se muestra.</p>
        {CAMPOS_CONTACTO.map(([k, label, ph, tipo]) => (
          <label key={k}>{label}<input name={`c_${k}`} type={tipo} defaultValue={ajustes?.contacto?.[k] ?? ""} placeholder={ph} /></label>
        ))}
        <label>Horario de atención (una línea por horario)
          <textarea name="c_horario" rows={3} defaultValue={ajustes?.contacto?.horario ?? ""} placeholder={"Lunes a viernes: 09:00 a 18:00 hrs\nSábado: 09:00 a 15:00 hrs"} />
        </label>
      </fieldset>
      <label>Color principal<input type="color" name="color" defaultValue={ajustes?.color ?? "#0b7f80"} /></label>
      <div>
        <div className="lbl">Banner de portada</div>
        {ajustes?.bannerUrl && <img className="banner-prev" src={ajustes.bannerUrl} alt="Banner actual" />}
        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <button type="button" className="btn" disabled={subiendoBanner} onClick={() => { if (picker.current) { picker.current.value = ""; picker.current.click(); } }}>
            {subiendoBanner ? "Subiendo…" : "🖼️ Cambiar banner"}
          </button>
          {ajustes?.bannerUrl && (
            <button type="button" className="btn ghost" onClick={() => { if (confirm("¿Quitar el banner de portada?")) void banner(null, "banner quitado").catch((er) => toast(mensaje(er))); }}>Quitar banner</button>
          )}
        </div>
        <input ref={picker} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void nuevoBanner(f); }} />
      </div>
      <menu>
        <button type="button" className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn" disabled={ocupado} style={{ background: "var(--brand)", color: "#fff" }}>{ocupado ? "Guardando…" : "Aplicar"}</button>
      </menu>
    </form>
  );
}
