/**
 * Precio que ve y paga el cliente.
 * Con oferta y precio de oferta: se cobra el precio de oferta y el precio normal aparece tachado como «Antes».
 * Sin precio de oferta se mantiene el comportamiento anterior (precio + «antes» opcional).
 */
export function precioPublico(p: { precio: number; oferta?: boolean; precioOferta?: number | null; antes?: number | null }) {
  if (p.oferta && p.precioOferta && p.precioOferta > 0) {
    return { precio: p.precioOferta, antes: p.precio > p.precioOferta ? p.precio : null };
  }
  return { precio: p.precio, antes: p.oferta && p.antes ? p.antes : null };
}
