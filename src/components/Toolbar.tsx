type Props = {
  onNuevoProducto: () => void;
  onNuevaCategoria: () => void;
  fondoOn: boolean;
  onToggleFondo: () => void;
  onImprimir: () => void;
  onCsv: () => void;
  onAjustes: () => void;
  onImportar: () => void;
  modoVista: boolean;
};

export function Toolbar(p: Props) {
  return (
    <div className="toolbar" role="toolbar" aria-label="Herramientas de edición">
      {!p.modoVista && (
        <>
          <button type="button" className="addp" onClick={p.onNuevoProducto}>＋ Nuevo producto</button>
          <button type="button" className="addp" onClick={p.onNuevaCategoria}>＋ Nueva categoría</button>
          <button type="button" onClick={p.onToggleFondo} title="Quitar el fondo de las fotos que subas, dejando solo el producto">🪄 Quitar fondo: {p.fondoOn ? "Sí" : "No"}</button>
        </>
      )}
      <button type="button" onClick={p.onImprimir}>🖨️ Imprimir / PDF</button>
      <button type="button" onClick={p.onCsv}>📊 Exportar CSV</button>
      {!p.modoVista && (
        <>
          <button type="button" onClick={p.onAjustes}>⚙️ Ajustes</button>
          <button type="button" onClick={p.onImportar}>📥 Importar</button>
        </>
      )}
      <span className="st">Los cambios se guardan solos</span>
    </div>
  );
}
