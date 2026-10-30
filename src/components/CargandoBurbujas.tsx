/** Burbujas de jabón que suben: indicador de carga común a todo el proyecto. */
const BURBUJAS = [
  { x: 12, s: 14, d: 0, t: 2.2 }, { x: 30, s: 22, d: 0.5, t: 2.6 }, { x: 50, s: 12, d: 1.1, t: 2 },
  { x: 66, s: 26, d: 0.2, t: 2.8 }, { x: 84, s: 16, d: 0.8, t: 2.3 }, { x: 40, s: 10, d: 1.5, t: 1.9 }, { x: 76, s: 11, d: 1.7, t: 2.1 },
];

type Props = {
  texto: string;
  /**
   * overlay: tapa por completo al ancestro posicionado más cercano (tarjeta, formulario, diálogo).
   * bloque: ocupa su lugar dentro de la página (listas que aún no llegan).
   * pantalla: cubre toda la ventana (carga inicial).
   */
  modo?: "overlay" | "bloque" | "pantalla";
};

export function CargandoBurbujas({ texto, modo = "overlay" }: Props) {
  return (
    <div className={`cargando-burbujas cb-${modo}`} role="status" aria-live="polite">
      {BURBUJAS.map((b, k) => (
        <span key={k} className="burbuja" aria-hidden="true"
          style={{ left: `${b.x}%`, width: b.s, height: b.s, animationDelay: `${b.d}s`, animationDuration: `${b.t}s` }} />
      ))}
      <div className="cb-centro">
        <div className="cb-puntos" aria-hidden="true"><i /><i /><i /></div>
        <span>{texto}</span>
      </div>
    </div>
  );
}
