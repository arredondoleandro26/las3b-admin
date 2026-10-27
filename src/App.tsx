import { useEffect, useMemo, useState } from "react";
import { Authenticated, AuthLoading, Unauthenticated, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../convex/_generated/api";
import type { Doc, Id } from "../convex/_generated/dataModel";
import { Login } from "./components/Login";
import { SeccionCategoria } from "./components/SeccionCategoria";
import { Toolbar } from "./components/Toolbar";
import { DialogoNuevoProducto } from "./components/DialogoNuevoProducto";
import { DialogoNuevaCategoria } from "./components/DialogoNuevaCategoria";
import { DialogoMover } from "./components/DialogoMover";
import { DialogoAjustes } from "./components/DialogoAjustes";
import { DialogoImportar } from "./components/DialogoImportar";
import { DialogoArchivados } from "./components/DialogoArchivados";
import { PaginaSolicitudes } from "./components/PaginaSolicitudes";
import { useFondo } from "./hooks/useFondo";
import { useToast } from "./hooks/useToast";
import { HistorialProvider, useHistorial } from "./hooks/useHistorial";
import { ESTADOS, descargar, norm } from "./lib/formato";

export default function App() {
  return (
    <>
      <AuthLoading><div className="cargando">Cargando…</div></AuthLoading>
      <Unauthenticated><Login /></Unauthenticated>
      <Authenticated><HistorialProvider><Panel /></HistorialProvider></Authenticated>
    </>
  );
}

type Dialogo = { tipo: "producto"; catId: Id<"categorias"> | null } | { tipo: "categoria" } | { tipo: "mover" } | { tipo: "ajustes" } | { tipo: "importar" } | { tipo: "archivados" } | null;

function Panel() {
  const { signOut } = useAuthActions();
  const toast = useToast();
  const historial = useHistorial();
  const usuario = useQuery(api.usuario.actual);
  const datos = useQuery(api.productos.listarTodo, usuario?.esAdmin ? {} : "skip");
  const archivados = useQuery(api.productos.listarArchivados, usuario?.esAdmin ? {} : "skip");
  const nuevas = useQuery(api.solicitudes.contarNuevas, usuario?.esAdmin ? {} : "skip");
  const [pestana, setPestana] = useState<"catalogo" | "solicitudes">("catalogo");

  const [busqueda, setBusqueda] = useState("");
  const [modoVista, setModoVista] = useState(false);
  const [sel, setSel] = useState<Set<Id<"productos">>>(new Set());
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [fondo, setFondo] = useFondo();

  useEffect(() => { document.body.classList.toggle("vista-cliente", modoVista); }, [modoVista]);
  useEffect(() => {
    const color = datos?.ajustes?.color;
    document.documentElement.style.setProperty("--brand", color || "#0b7f80");
  }, [datos?.ajustes?.color]);
  useEffect(() => {
    const n = datos?.ajustes?.nombre;
    document.title = n ? `Administración · ${n}` : "Administración del catálogo";
  }, [datos?.ajustes?.nombre]);

  // evita que soltar una imagen fuera de una zona válida abra el archivo en el navegador
  useEffect(() => {
    const h = (e: Event) => { const dt = (e as globalThis.DragEvent).dataTransfer; if (dt && [...dt.types].includes("Files")) e.preventDefault(); };
    window.addEventListener("dragover", h); window.addEventListener("drop", h);
    return () => { window.removeEventListener("dragover", h); window.removeEventListener("drop", h); };
  }, []);

  // Ctrl+Z / Ctrl+Y (y Ctrl+Shift+Z). Dentro de un campo de texto queda el deshacer propio del navegador.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || modoVista || pestana !== "catalogo") return;
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable=true]") || document.querySelector("dialog[open]")) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) { e.preventDefault(); void historial.deshacer().then((ok) => { if (!ok) toast("No hay nada más que deshacer."); }); }
      else if (k === "y" || (k === "z" && e.shiftKey)) { e.preventDefault(); void historial.rehacer().then((ok) => { if (!ok) toast("No hay nada que rehacer."); }); }
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [historial, modoVista, pestana, toast]);

  const palabras = useMemo(() => norm(busqueda).split(/\s+/).filter(Boolean), [busqueda]);
  const filtrando = palabras.length > 0;

  const porCategoria = useMemo(() => {
    const m = new Map<Id<"categorias">, Doc<"productos">[]>();
    if (!datos) return m;
    for (const c of datos.categorias) m.set(c._id, []);
    for (const p of datos.productos) {
      const c = datos.categorias.find((x) => x._id === p.catId);
      if (!c) continue;
      if (modoVista && p.estado === "descontinuado") continue;
      if (filtrando) {
        const hay = norm(p.nombre + " " + c.nombre);
        if (!palabras.every((w) => hay.includes(w))) continue;
      }
      m.get(c._id)!.push(p);
    }
    return m;
  }, [datos, palabras, filtrando, modoVista]);

  if (usuario === undefined) return <div className="cargando">Cargando…</div>;
  if (usuario && !usuario.esAdmin) {
    return (
      <div className="login">
        <form onSubmit={(e) => { e.preventDefault(); void signOut(); }}>
          <h1>Sin permisos</h1>
          <p style={{ margin: 0, color: "var(--muted)" }}>La cuenta <b>{usuario.email}</b> no está autorizada para administrar el catálogo. Pide que agreguen tu correo a la lista de administradores.</p>
          <button className="btn">Cerrar sesión</button>
        </form>
      </div>
    );
  }
  if (!datos) return <div className="cargando">Cargando catálogo…</div>;

  const { categorias, productos, ajustes } = datos;

  function toggleSel(id: Id<"productos">, on: boolean) {
    setSel((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n; });
  }
  function seleccionarCat(ids: Id<"productos">[]) {
    setSel((s) => {
      const n = new Set(s);
      const todos = ids.every((id) => n.has(id));
      ids.forEach((id) => (todos ? n.delete(id) : n.add(id)));
      return n;
    });
  }

  function exportarCsv() {
    const rows: (string | number)[][] = [["Categoría", "Producto", "Precio", "Estado", "Oferta", "Precio anterior"]];
    for (const c of categorias) for (const p of productos.filter((x) => x.catId === c._id)) {
      rows.push([c.nombre, p.nombre, p.precio, ESTADOS[p.estado], p.oferta ? "Sí" : "", p.oferta && p.antes ? p.antes : ""]);
    }
    const csv = "﻿" + rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\r\n");
    descargar(new Blob([csv], { type: "text/csv;charset=utf-8" }), `Precios ${ajustes?.periodo ?? ""}.csv`.replace(/\s+/g, " "));
  }

  async function imprimir() {
    const estaba = modoVista;
    setModoVista(true);
    await new Promise((r) => setTimeout(r, 250));
    await Promise.race([
      Promise.all([...document.querySelectorAll<HTMLImageElement>("#secciones img")].map((i) => i.decode().catch(() => {}))),
      new Promise((r) => setTimeout(r, 4000)),
    ]);
    window.print();
    if (!estaba) setModoVista(false);
  }

  const irA = (id: string) => document.getElementById(`cat-${id}`)?.scrollIntoView();
  const hayDatos = categorias.length > 0 || productos.length > 0;

  return (
    <>
      {pestana === "catalogo" && (
        <div className="editbar">
          ✏️ Modo edición: cambia nombres, precios, estados e imágenes directamente en cada producto. Para cambiar el orden, arrastra el asa <b>⠿ Mover</b>. Todo se guarda al instante y el catálogo público se actualiza solo.
        </div>
      )}
      <header className="topbar">
        <div className="wrap bar">
          <a className="brand" href="#top"><span className="brand-ico">🫧</span><span id="brandName">{ajustes?.nombre ?? "Catálogo"}</span></a>
          <nav className="tabs" aria-label="Secciones del panel">
            <button type="button" className={pestana === "catalogo" ? "on" : ""} onClick={() => setPestana("catalogo")} title="Catálogo">🛍️<span className="tl"> Catálogo</span></button>
            <button type="button" className={pestana === "solicitudes" ? "on" : ""} onClick={() => { setPestana("solicitudes"); setModoVista(false); }} title="Solicitudes de contacto">
              📨<span className="tl"> Solicitudes</span>{nuevas ? <b title={`${nuevas} sin leer`}>{nuevas}</b> : null}
            </button>
          </nav>
          {pestana === "catalogo" && <>
          <div className="search"><span className="sico">🔍</span>
            <input type="search" placeholder="Buscar producto…" aria-label="Buscar producto" autoComplete="off" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          </div>
          <select className="jump desk" aria-label="Ir a departamento" value="" onChange={(e) => irA(e.target.value)}>
            <option value="">Ir a departamento…</option>
            {categorias.map((c) => <option key={c._id} value={c._id}>{c.icono} {c.nombre}</option>)}
          </select>
          </>}
          <span className="grow" />
          {pestana === "catalogo" && <button type="button" className={`vistabtn${modoVista ? " on" : ""}`} onClick={() => setModoVista(!modoVista)} title="Ver el catálogo tal como lo ve el cliente">
            {modoVista ? "✏️ Volver a editar" : "👁 Vista cliente"}
          </button>}
          <span className="userchip desk">{usuario?.email}</span>
          <button type="button" className="salir" onClick={() => void signOut()}>Salir</button>
        </div>
      </header>

      {pestana === "solicitudes" ? <PaginaSolicitudes negocio={ajustes?.nombre ?? ""} /> : <>
      <main id="top">
        {modoVista && (
          <section className="hero wrap">
            {ajustes?.bannerUrl && <img className="banner" src={ajustes.bannerUrl} alt={ajustes.nombre} />}
            <h1>{ajustes?.titulo ?? "Catálogo de productos"}</h1>
            <div className="pills">
              {ajustes?.periodo && <span className="pill y">📅 Actualizado a la fecha: {ajustes.periodo}</span>}
              {ajustes?.precioNota && <span className="pill b">{ajustes.precioNota}</span>}
            </div>
            {ajustes?.aviso && <p className="aviso">{ajustes.aviso}</p>}
          </section>
        )}
        <div className="wrap" id="secciones">
          {categorias.length === 0 && (
            <div className="empty">
              Aún no hay categorías. Crea una con <b>＋ Nueva categoría</b> o usa <b>📥 Importar</b> para traer el catálogo antiguo.
            </div>
          )}
          {categorias.map((c, i) => (
            <SeccionCategoria
              key={c._id}
              cat={c}
              productos={porCategoria.get(c._id) ?? []}
              categorias={categorias}
              sel={sel}
              onSeleccion={toggleSel}
              onSeleccionarCat={seleccionarCat}
              onAgregarProducto={(catId) => setDialogo({ tipo: "producto", catId })}
              filtrando={filtrando}
              modoVista={modoVista}
              fondo={fondo}
              esPrimera={i === 0}
              esUltima={i === categorias.length - 1}
            />
          ))}
          {filtrando && [...porCategoria.values()].every((l) => !l.length) && (
            <div className="empty">😕 No encontramos productos para “{busqueda}”.</div>
          )}
          {!modoVista && !filtrando && categorias.length > 0 && (
            <button type="button" className="addcat" onClick={() => setDialogo({ tipo: "categoria" })}>＋ Nueva categoría</button>
          )}
        </div>
      </main>

      {modoVista && ajustes && (
        <footer className="pie">
          <div className="t">{ajustes.nombre}</div>
          <p>{ajustes.pie}</p>
          {ajustes.periodo && <small>Catálogo actualizado a {ajustes.periodo}</small>}
        </footer>
      )}

      {!modoVista && sel.size > 0 && (
        <div className="selbar">
          <span>{sel.size} producto{sel.size === 1 ? "" : "s"} seleccionado{sel.size === 1 ? "" : "s"}</span>
          <button type="button" className="go" onClick={() => setDialogo({ tipo: "mover" })}>↔ Mover a otra categoría…</button>
          <button type="button" onClick={() => setSel(new Set())}>Quitar selección</button>
        </div>
      )}

      <Toolbar
        modoVista={modoVista}
        onNuevoProducto={() => { if (!categorias.length) return toast("Primero crea una categoría con «＋ Nueva categoría»."); setDialogo({ tipo: "producto", catId: null }); }}
        onNuevaCategoria={() => setDialogo({ tipo: "categoria" })}
        fondoOn={fondo.on}
        onToggleFondo={() => { setFondo({ on: !fondo.on }); toast(!fondo.on ? "🪄 Las fotos que subas quedarán sin fondo (solo el producto)." : "Las fotos que subas se guardarán tal cual, con su fondo."); }}
        onImprimir={() => void imprimir()}
        onCsv={exportarCsv}
        onAjustes={() => setDialogo({ tipo: "ajustes" })}
        onImportar={() => setDialogo({ tipo: "importar" })}
        onArchivados={() => setDialogo({ tipo: "archivados" })}
        nArchivados={archivados?.length ?? 0}
        onDeshacer={() => void historial.deshacer()}
        onRehacer={() => void historial.rehacer()}
        puedeDeshacer={historial.puedeDeshacer}
        puedeRehacer={historial.puedeRehacer}
        pasos={historial.pasos}
      />
      </>}

      <DialogoNuevoProducto
        open={dialogo?.tipo === "producto"}
        onClose={() => setDialogo(null)}
        categorias={categorias}
        catInicial={dialogo?.tipo === "producto" ? dialogo.catId : null}
        fondo={fondo}
        setFondo={setFondo}
      />
      <DialogoNuevaCategoria
        open={dialogo?.tipo === "categoria"}
        onClose={() => setDialogo(null)}
        categorias={categorias}
        onCrearYAgregar={(catId) => setDialogo({ tipo: "producto", catId })}
      />
      <DialogoMover
        open={dialogo?.tipo === "mover"}
        onClose={() => setDialogo(null)}
        categorias={categorias}
        productos={productos}
        ids={[...sel]}
        onMovidos={() => setSel(new Set())}
      />
      <DialogoAjustes open={dialogo?.tipo === "ajustes"} onClose={() => setDialogo(null)} ajustes={ajustes} />
      <DialogoArchivados open={dialogo?.tipo === "archivados"} onClose={() => setDialogo(null)} categorias={categorias} onPurgado={historial.purgar} />
      <DialogoImportar open={dialogo?.tipo === "importar"} onClose={() => setDialogo(null)} hayDatos={hayDatos} />
    </>
  );
}
