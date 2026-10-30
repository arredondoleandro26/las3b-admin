import { fmt, num, type Estado } from "../lib/formato";
import { precioPublico } from "../../convex/lib/precio";

export type DatosVista = {
  nombre: string;
  precio: number;
  estado: Estado;
  oferta?: boolean;
  antes?: number | null;
  precioOferta?: number | null;
  imagenes: string[];
  icono: string;
};

/** Carrito con un «+» (igual que el botón de agregar del catálogo). */
function IconoCarritoMas() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 4h2l2.2 10.2a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.1L20.5 8H6.2" />
      <circle cx="9.5" cy="19.5" r="1.3" />
      <circle cx="17" cy="19.5" r="1.3" />
      <path d="M13 6.5v-4M11 4.5h4" strokeWidth="2.4" />
    </svg>
  );
}

/** Tarjeta tal como la ve el cliente (misma estructura que en las3b-catalogo). */
export function TarjetaVista({ p }: { p: DatosVista }) {
  const { precio, antes } = precioPublico(p);
  return (
    <article className={`card ${p.estado}${p.oferta ? " oferta" : ""}`}>
      {p.oferta && <span className="badge-oferta">OFERTA</span>}
      <div className="media">
        {p.imagenes.length ? (
          <div className="pic">
            {p.imagenes.map((src, k) => <img key={k} src={src} alt={k ? "" : p.nombre} decoding="async" loading="lazy" />)}
          </div>
        ) : (
          <div className="pic ph" aria-hidden="true">{p.icono || "🛍️"}</div>
        )}
        {p.estado === "disponible" && (
          <div className="qty" aria-hidden="true"><span className="add"><IconoCarritoMas /></span></div>
        )}
      </div>
      {p.estado === "sinstock" && <span className="ribbon">SIN STOCK</span>}
      <h3 className="nombre" title={p.nombre}>{p.nombre}</h3>
      <div className="buy">
        <div className="pbox">
          <span className="antes">{antes ? `Antes ${fmt(antes)}` : ""}</span>
          <div className="tag"><span className="cur">$</span><span className="num">{num(precio)}</span><span className="cu">c/u</span></div>
        </div>
      </div>
    </article>
  );
}
