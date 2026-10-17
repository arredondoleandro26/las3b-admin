import { useRef, useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import { procesarBanner } from "../lib/imagen";
import { useSubirArchivo } from "../lib/subir";
import { Modal } from "./Modal";
import { mensaje } from "./TarjetaEdicion";
import { useToast } from "../hooks/useToast";

type Props = { open: boolean; onClose: () => void; ajustes: Doc<"ajustes"> | null };

const CAMPOS = [
  ["nombre", "Nombre del negocio", "Ej: Jabonería Las 3B"],
  ["titulo", "Título", "Ej: Catálogo de precios"],
  ["periodo", "Actualizado a", "Ej: Octubre 2026"],
  ["precioNota", "Nota de precios", "Ej: Precio detalle · IVA incluido"],
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
      await actualizar({
        nombre: g("nombre") || "Mi negocio",
        titulo: g("titulo") || "Catálogo de precios",
        periodo: g("periodo"),
        precioNota: g("precioNota"),
        aviso: g("aviso"),
        whatsapp: g("whatsapp"),
        pie: g("pie"),
        color: g("color") || "#0b7f80",
      });
      toast("✅ Ajustes guardados");
      onClose();
    } catch (er) { toast(mensaje(er)); }
    finally { setOcupado(false); }
  }

  async function nuevoBanner(file: File) {
    setSubiendoBanner(true);
    try {
      const blob = await procesarBanner(file);
      const storageId = await subir(blob);
      await cambiarBanner({ storageId });
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
      <label>Color principal<input type="color" name="color" defaultValue={ajustes?.color ?? "#0b7f80"} /></label>
      <div>
        <div className="lbl">Banner de portada</div>
        {ajustes?.bannerUrl && <img className="banner-prev" src={ajustes.bannerUrl} alt="Banner actual" />}
        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <button type="button" className="btn" disabled={subiendoBanner} onClick={() => { if (picker.current) { picker.current.value = ""; picker.current.click(); } }}>
            {subiendoBanner ? "Subiendo…" : "🖼️ Cambiar banner"}
          </button>
          {ajustes?.bannerUrl && (
            <button type="button" className="btn ghost" onClick={() => { if (confirm("¿Quitar el banner de portada?")) void cambiarBanner({ storageId: null }).catch((er) => toast(mensaje(er))); }}>Quitar banner</button>
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
