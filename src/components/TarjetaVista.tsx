import { fmt, num, type Estado } from "../lib/formato";

export type DatosVista = {
  nombre: string;
  precio: number;
  estado: Estado;
  oferta?: boolean;
  antes?: number | null;
  imagenes: string[];
  icono: string;
};

/** Tarjeta tal como la ve el cliente (misma estructura que en las3b-catalogo). */
export function TarjetaVista({ p }: { p: DatosVista }) {
  return (
    <article className={`card ${p.estado}${p.oferta ? " oferta" : ""}`}>
      {p.oferta && <span className="badge-oferta">OFERTA</span>}
      {p.imagenes.length ? (
        <div className="pic">
          {p.imagenes.map((src, k) => <img key={k} src={src} alt={k ? "" : p.nombre} decoding="async" loading="lazy" />)}
        </div>
      ) : (
        <div className="pic ph" aria-hidden="true">{p.icono || "🛍️"}</div>
      )}
      {p.estado === "sinstock" && <span className="ribbon">SIN STOCK</span>}
      <h3 className="nombre" title={p.nombre}>{p.nombre}</h3>
      <div className="buy">
        <div className="pbox">
          {p.oferta && p.antes ? <span className="antes">Antes {fmt(p.antes)}</span> : null}
          <div className="tag"><span className="cur">$</span><span className="num">{num(p.precio)}</span><span className="cu">c/u</span></div>
        </div>
        <div className="qty">
          {p.estado !== "disponible" && <span className="nostock">{p.estado === "sinstock" ? "Sin stock" : "No disponible"}</span>}
        </div>
      </div>
    </article>
  );
}
