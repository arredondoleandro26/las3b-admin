import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { contactoImportado, type CampoContacto } from "../../convex/lib/contacto";
import { useHistorial } from "../hooks/useHistorial";
import { useConfirmar } from "../hooks/useConfirmar";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { dataUriABlob } from "../lib/imagen";
import { enParalelo, useSubirArchivo } from "../lib/subir";
import type { Estado } from "../lib/formato";
import { Modal } from "./Modal";
import { mensaje } from "./TarjetaEdicion";
import { CargandoBurbujas } from "./CargandoBurbujas";

/** Forma del JSON embebido en el catálogo HTML antiguo (<script id="catalog-data">). */
type CatalogoAntiguo = {
  id?: string;
  meta: { nombre?: string; titulo?: string; periodo?: string; precioNota?: string; aviso?: string; whatsapp?: string; pie?: string; color?: string; contacto?: Partial<Record<CampoContacto, string>> };
  categorias: { id: string; nombre: string; icono: string }[];
  productos: { id: string; cat: string; nombre: string; precio: number; estado: string; imgs?: string[]; oferta?: boolean; antes?: number | null }[];
  imagenes: Record<string, string>;
};

type Props = { open: boolean; onClose: () => void; hayDatos: boolean };

export function DialogoImportar({ open, onClose, hayDatos }: Props) {
  return (
    <Modal open={open} onClose={onClose} className="nc">
      <Importador onClose={onClose} hayDatos={hayDatos} />
    </Modal>
  );
}

function extraerJSON(texto: string): CatalogoAntiguo {
  let json = texto.trim();
  if (!json.startsWith("{")) {
    const m = /<script[^>]*id="catalog-data"[^>]*>([\s\S]*?)<\/script>/i.exec(texto);
    if (!m) throw new Error("No encontré los datos del catálogo en ese archivo. Debe ser el HTML del catálogo antiguo o su JSON.");
    json = m[1];
  }
  const d = JSON.parse(json) as CatalogoAntiguo;
  if (!Array.isArray(d.categorias) || !Array.isArray(d.productos) || typeof d.imagenes !== "object") {
    throw new Error("El archivo no tiene la estructura esperada (categorias, productos, imagenes).");
  }
  return d;
}

function Importador({ onClose, hayDatos }: Omit<Props, "open">) {
  const subir = useSubirArchivo();
  const h = useHistorial();
  const confirmar = useConfirmar();
  const vaciar = useMutation(api.importar.vaciar);
  const impCategorias = useMutation(api.importar.categorias);
  const impProductos = useMutation(api.importar.productos);
  const impAjustes = useMutation(api.importar.ajustes);

  const [datos, setDatos] = useState<CatalogoAntiguo | null>(null);
  const [nombreArchivo, setNombreArchivo] = useState("");
  const [reemplazar, setReemplazar] = useState(hayDatos);
  const [error, setError] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const [progreso, setProgreso] = useState<{ hecho: number; total: number } | null>(null);
  const [corriendo, setCorriendo] = useState(false);
  const [listo, setListo] = useState(false);
  const picker = useRef<HTMLInputElement>(null);

  const agregarLog = (s: string) => setLog((l) => [...l, s]);

  async function leerArchivo(f: File) {
    setError(""); setDatos(null); setListo(false); setLog([]);
    try {
      const texto = await f.text();
      setDatos(extraerJSON(texto));
      setNombreArchivo(f.name);
    } catch (e) { setError(mensaje(e)); }
  }

  const imagenesUsadas = (d: CatalogoAntiguo) => {
    const ids = new Set<string>();
    d.productos.forEach((p) => (p.imgs ?? []).forEach((i) => { if (d.imagenes[i]) ids.add(i); }));
    if (d.imagenes.banner) ids.add("banner");
    return [...ids];
  };

  async function importar() {
    if (!datos) return;
    if (reemplazar && !(await confirmar({
      titulo: "¿Reemplazar todo el catálogo?",
      mensaje: "Se borrarán TODAS las categorías, productos e imágenes actuales antes de importar. No se puede deshacer.",
      aceptar: "Borrar e importar",
      peligro: true,
    }))) return;
    setCorriendo(true); setError(""); setLog([]);
    h.limpiar(); // una importación no se deshace paso a paso
    try {
      if (reemplazar) {
        const r = await vaciar();
        agregarLog(`🗑 Catálogo anterior vaciado (${r.productos} productos, ${r.categorias} categorías).`);
      }
      // 1) imágenes
      const ids = imagenesUsadas(datos);
      setProgreso({ hecho: 0, total: ids.length });
      agregarLog(`⬆️ Subiendo ${ids.length} imágenes…`);
      const mapaImg = new Map<string, Id<"_storage">>();
      let hecho = 0, fallidas = 0;
      await enParalelo(ids, 4, async (id) => {
        try {
          const blob = dataUriABlob(datos.imagenes[id]);
          mapaImg.set(id, await subir(blob));
        } catch (e) { fallidas++; console.error(id, e); }
        hecho++;
        setProgreso({ hecho, total: ids.length });
      });
      agregarLog(`✅ Imágenes subidas: ${mapaImg.size}${fallidas ? ` (${fallidas} fallaron)` : ""}.`);

      // 2) categorías
      const mapaCat = await impCategorias({ items: datos.categorias.map((c) => ({ idAntiguo: c.id, nombre: c.nombre, icono: c.icono })) });
      agregarLog(`✅ ${datos.categorias.length} categorías creadas.`);

      // 3) productos por lotes, conservando el orden dentro de cada categoría
      const ordenPorCat = new Map<string, number>();
      const items = datos.productos
        .filter((p) => mapaCat[p.cat])
        .map((p) => {
          const orden = ordenPorCat.get(p.cat) ?? 0;
          ordenPorCat.set(p.cat, orden + 1);
          const estado: Estado = p.estado === "sinstock" || p.estado === "descontinuado" ? p.estado : "disponible";
          return {
            catId: mapaCat[p.cat],
            nombre: p.nombre,
            precio: Number(p.precio) || 0,
            estado,
            oferta: p.oferta ? true : undefined,
            antes: p.antes ? Number(p.antes) : undefined,
            orden,
            imagenes: (p.imgs ?? []).map((i) => mapaImg.get(i)).filter((x): x is Id<"_storage"> => !!x),
          };
        });
      const omitidos = datos.productos.length - items.length;
      let insertados = 0;
      for (let i = 0; i < items.length; i += 50) {
        insertados += await impProductos({ items: items.slice(i, i + 50) });
        setProgreso({ hecho: insertados, total: items.length });
      }
      agregarLog(`✅ ${insertados} productos importados${omitidos ? ` (${omitidos} omitidos por categoría desconocida)` : ""}.`);

      // 4) ajustes + banner
      const m = datos.meta ?? {};
      await impAjustes({
        nombre: m.nombre ?? "Mi negocio",
        titulo: m.titulo ?? "Catálogo de productos",
        periodo: m.periodo ?? "",
        precioNota: m.precioNota ?? "",
        aviso: m.aviso ?? "",
        whatsapp: m.whatsapp ?? "",
        pie: m.pie ?? "",
        color: m.color ?? "#0b7f80",
        contacto: contactoImportado(m.contacto),
        bannerId: mapaImg.get("banner"),
      });
      agregarLog("✅ Ajustes del negocio y banner aplicados.");
      setListo(true);
    } catch (e) {
      setError(mensaje(e));
      agregarLog("❌ " + mensaje(e));
    } finally {
      setCorriendo(false);
    }
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); void importar(); }}>
      {corriendo && <CargandoBurbujas texto={progreso ? `Importando… ${progreso.hecho} / ${progreso.total}` : "Importando…"} />}
      <h3>📥 Importar catálogo antiguo</h3>
      {!datos && (
        <div className="filepick">
          <p style={{ margin: 0, fontSize: ".88rem" }}>Elige el archivo <b>Catalogo … .html</b> que usabas antes (o su JSON). Se leerán sus categorías, productos, imágenes y ajustes.</p>
          <button type="button" className="btn" onClick={() => picker.current?.click()}>Elegir archivo…</button>
          <input ref={picker} type="file" accept=".html,.htm,.json,text/html,application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void leerArchivo(f); }} />
        </div>
      )}
      {datos && !listo && (
        <>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: ".85rem" }}>Archivo: <b>{nombreArchivo}</b></p>
          <div className="resumen">
            <div><b>{datos.categorias.length}</b><span>categorías</span></div>
            <div><b>{datos.productos.length}</b><span>productos</span></div>
            <div><b>{imagenesUsadas(datos).length}</b><span>imágenes</span></div>
          </div>
          {hayDatos && (
            <label className="chk2" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <input type="checkbox" checked={reemplazar} onChange={(e) => setReemplazar(e.target.checked)} disabled={corriendo} />
              Reemplazar el catálogo actual (borra lo que hay ahora)
            </label>
          )}
          {progreso && (
            <div>
              <div className="progreso"><i style={{ width: `${progreso.total ? (progreso.hecho / progreso.total) * 100 : 0}%` }} /></div>
              <small style={{ color: "var(--muted)" }}>{progreso.hecho} / {progreso.total}</small>
            </div>
          )}
        </>
      )}
      {log.length > 0 && <div className="log">{log.join("\n")}</div>}
      {listo && <p className="ok-msg">🎉 Importación terminada. Cierra esta ventana para ver el catálogo.</p>}
      <p className="np-msg" role="alert">{error}</p>
      <menu>
        {datos && !listo && (
          <button className="btn" disabled={corriendo} style={{ background: "var(--brand)", color: "#fff" }}>{corriendo ? "Importando…" : "Importar"}</button>
        )}
        {datos && !corriendo && !listo && <button type="button" className="btn" onClick={() => { setDatos(null); setLog([]); setProgreso(null); }}>Elegir otro archivo</button>}
        <button type="button" className="btn" disabled={corriendo} onClick={onClose}>{listo ? "Cerrar" : "Cancelar"}</button>
      </menu>
    </form>
  );
}
