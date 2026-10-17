/**
 * Procesamiento de fotos de producto en el navegador (portado del catálogo HTML original):
 *  - reduce a 420 px y comprime a JPEG sobre fondo blanco
 *  - opcionalmente "quita el fondo": mira el color del fondo en los bordes de la foto y lo va borrando
 *    hacia adentro mientras el color cambie poco; lo que no se puede borrar es el producto.
 *    Funciona con fondos lisos o degradados suaves (pared, mesa, papel). No sirve con fondos con textura.
 */

export type OpcionesFondo = { on: boolean; tol: number };
export type Resultado = { blob: Blob; removed: boolean | null };

const MAX = 420;
const Q = 0.86;

function canvasABlob(c: HTMLCanvasElement, tipo = "image/jpeg", q = Q): Promise<Blob> {
  return new Promise((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error("No se pudo codificar la imagen."))), tipo, q));
}

function bgMask(px: Uint8ClampedArray, w: number, h: number, tol: number): Uint8Array | null {
  const n = w * h;
  const Tg = 18 + tol;
  const Ts = 4 + tol * 0.2;
  const border: number[] = [];
  for (let x = 0; x < w; x++) border.push(x, (h - 1) * w + x);
  for (let y = 1; y < h - 1; y++) border.push(y * w, y * w + w - 1);
  const med = (c: number) => {
    const a = border.map((i) => px[i * 4 + c]).sort((p, q) => p - q);
    return a[a.length >> 1];
  };
  const r0 = med(0), g0 = med(1), b0 = med(2);
  const dRef = (i: number) => {
    const a = px[i * 4] - r0, b = px[i * 4 + 1] - g0, c = px[i * 4 + 2] - b0;
    return Math.sqrt(a * a + b * b + c * c);
  };
  const dPix = (i: number, j: number) => {
    const a = px[i * 4] - px[j * 4], b = px[i * 4 + 1] - px[j * 4 + 1], c = px[i * 4 + 2] - px[j * 4 + 2];
    return Math.sqrt(a * a + b * b + c * c);
  };
  const bg = new Uint8Array(n);
  const q = new Int32Array(n);
  let qh = 0, qt = 0;
  for (const i of border) if (!bg[i] && dRef(i) <= Tg) { bg[i] = 1; q[qt++] = i; }
  if (qt < border.length * 0.5) return null; // los bordes no se parecen entre sí: fondo no liso
  const grow = (i: number, j: number) => {
    if (!bg[j] && dRef(j) <= Tg && dPix(i, j) <= Ts) { bg[j] = 1; q[qt++] = j; }
  };
  while (qh < qt) {
    const i = q[qh++], x = i % w, y = (i / w) | 0;
    if (x > 0) grow(i, i - 1);
    if (x < w - 1) grow(i, i + 1);
    if (y > 0) grow(i, i - w);
    if (y < h - 1) grow(i, i + w);
  }
  // 2ª pasada (solo fondos claros): la sombra del producto tiene el mismo tono que el fondo pero más oscuro
  const s0 = r0 + g0 + b0;
  if (s0 > 300) {
    const cr0 = r0 / s0, cg0 = g0 / s0;
    const shadow = (j: number) => {
      const s = px[j * 4] + px[j * 4 + 1] + px[j * 4 + 2];
      if (s < s0 * 0.6 || s > s0 * 1.02) return false;
      return Math.abs(px[j * 4] / s - cr0) + Math.abs(px[j * 4 + 1] / s - cg0) <= 0.03;
    };
    const lum = (j: number) => px[j * 4] + px[j * 4 + 1] + px[j * 4 + 2];
    qh = qt = 0;
    for (let i = 0; i < n; i++) {
      if (!bg[i]) continue;
      const x = i % w, y = (i / w) | 0;
      if ((x > 0 && !bg[i - 1]) || (x < w - 1 && !bg[i + 1]) || (y > 0 && !bg[i - w]) || (y < h - 1 && !bg[i + w])) q[qt++] = i;
    }
    const grow2 = (i: number, j: number) => {
      if (!bg[j] && shadow(j) && dPix(i, j) <= 9 && lum(j) <= lum(i) + 3) { bg[j] = 1; q[qt++] = j; }
    };
    while (qh < qt) {
      const i = q[qh++], x = i % w, y = (i / w) | 0;
      if (x > 0) grow2(i, i - 1);
      if (x < w - 1) grow2(i, i + 1);
      if (y > 0) grow2(i, i - w);
      if (y < h - 1) grow2(i, i + w);
    }
  }
  // producto = lo que no es fondo; se descartan las manchas chicas sueltas
  const lab = new Int32Array(n), stack = new Int32Array(n), areas = [0];
  let nl = 0, maxA = 0;
  for (let s = 0; s < n; s++) {
    if (bg[s] || lab[s]) continue;
    nl++;
    let sp = 0, a = 0;
    stack[sp++] = s; lab[s] = nl;
    while (sp) {
      const i = stack[--sp]; a++;
      const x = i % w, y = (i / w) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const j = yy * w + xx;
        if (!bg[j] && !lab[j]) { lab[j] = nl; stack[sp++] = j; }
      }
    }
    areas.push(a);
    if (a > maxA) maxA = a;
  }
  const minA = Math.max(10, maxA * 0.02), keep = new Uint8Array(n);
  let area = 0;
  for (let i = 0; i < n; i++) if (lab[i] && areas[lab[i]] >= minA) { keep[i] = 1; area++; }
  if (area < n * 0.015 || area > n * 0.7) return null; // no se encontró producto, o casi no se quitó fondo
  let onEdge = 0;
  for (const i of border) if (keep[i]) onEdge++;
  if (onEdge > border.length * 0.2) return null; // el "producto" toca gran parte del borde: es fondo con textura
  if (area < 2500) return keep;
  const out = new Uint8Array(n); // se "come" 1 px del borde para no dejar halo de fondo
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (!keep[i]) continue;
    out[i] = (x === 0 || keep[i - 1]) && (x === w - 1 || keep[i + 1]) && (y === 0 || keep[i - w]) && (y === h - 1 || keep[i + w]) ? 1 : 0;
  }
  return out;
}

type Segmento = { W: number; H: number; px: Uint8ClampedArray; alpha: Uint8Array | null };

function bgSegment(bmp: ImageBitmap, tol: number): Segmento {
  const k = Math.min(1, 1400 / Math.max(bmp.width, bmp.height));
  const W = Math.max(1, Math.round(bmp.width * k)), H = Math.max(1, Math.round(bmp.height * k));
  const big = document.createElement("canvas"); big.width = W; big.height = H;
  const bx = big.getContext("2d", { willReadFrequently: true })!;
  bx.drawImage(bmp, 0, 0, W, H);
  const px = bx.getImageData(0, 0, W, H).data;
  const alpha = new Uint8Array(W * H);
  let semi = 0;
  for (let i = 3; i < px.length; i += 4) if (px[i] < 250) semi++;
  if (semi > W * H * 0.005) { // ya viene recortada (PNG con transparencia)
    for (let i = 0; i < W * H; i++) alpha[i] = px[i * 4 + 3];
    return { W, H, px, alpha };
  }
  const ks = Math.min(1, 360 / Math.max(W, H));
  const w = Math.max(8, Math.round(W * ks)), h = Math.max(8, Math.round(H * ks));
  const sm = document.createElement("canvas"); sm.width = w; sm.height = h;
  const sx = sm.getContext("2d", { willReadFrequently: true })!;
  sx.drawImage(big, 0, 0, w, h);
  const small = sx.getImageData(0, 0, w, h).data;
  let mask: Uint8Array | null = null;
  for (let t = tol; t <= Math.min(100, tol + 45) && !mask; t += 15) mask = bgMask(small, w, h, t);
  if (!mask) return { W, H, px, alpha: null };
  const mi = sx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const v = mask[i] ? 255 : 0;
    mi.data[i * 4] = mi.data[i * 4 + 1] = mi.data[i * 4 + 2] = v;
    mi.data[i * 4 + 3] = 255;
  }
  sx.putImageData(mi, 0, 0);
  const up = document.createElement("canvas"); up.width = W; up.height = H;
  const ux = up.getContext("2d", { willReadFrequently: true })!;
  ux.imageSmoothingEnabled = true; ux.imageSmoothingQuality = "high";
  ux.drawImage(sm, 0, 0, W, H); // al ampliar la máscara el borde queda suave
  const ud = ux.getImageData(0, 0, W, H).data;
  for (let i = 0; i < W * H; i++) {
    const t = (ud[i * 4] - 70) / 115;
    alpha[i] = t <= 0 ? 0 : t >= 1 ? 255 : Math.round(t * 255);
  }
  return { W, H, px, alpha };
}

/** Foto tal cual, sobre blanco y más liviana. */
async function aplanar(bmp: ImageBitmap, max: number, q: number, tipo: "image/jpeg" | "image/webp" = "image/jpeg"): Promise<Blob> {
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(bmp.width * k));
  c.height = Math.max(1, Math.round(bmp.height * k));
  const x = c.getContext("2d")!;
  if (tipo === "image/jpeg") { x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); }
  x.drawImage(bmp, 0, 0, c.width, c.height);
  return canvasABlob(c, tipo, q);
}

/** Banner de portada: hasta 1400 px, WebP con transparencia. */
export async function procesarBanner(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  try { return await aplanar(bmp, 1400, 0.88, "image/webp"); } finally { bmp.close(); }
}

/** Foto de producto. removed: null (no se pidió quitar fondo), true (ok) o false (no se pudo). */
export async function procesarProducto(src: File | ImageBitmap, opt: OpcionesFondo): Promise<Resultado> {
  const bmp = src instanceof ImageBitmap ? src : await createImageBitmap(src);
  try {
    if (!opt.on) return { blob: await aplanar(bmp, MAX, Q), removed: null };
    const seg = bgSegment(bmp, opt.tol);
    if (!seg.alpha) return { blob: await aplanar(bmp, MAX, Q), removed: false };
    const { W, H, px, alpha } = seg;
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    const oc = document.createElement("canvas"); oc.width = W; oc.height = H;
    const ox = oc.getContext("2d", { willReadFrequently: true })!;
    const od = ox.createImageData(W, H), d = od.data;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, a = alpha[i] / 255, o = 255 * (1 - a);
      d[i * 4] = px[i * 4] * a + o;
      d[i * 4 + 1] = px[i * 4 + 1] * a + o;
      d[i * 4 + 2] = px[i * 4 + 2] * a + o;
      d[i * 4 + 3] = 255;
      if (alpha[i] > 127) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    if (x1 < 0) return { blob: await aplanar(bmp, MAX, Q), removed: false };
    ox.putImageData(od, 0, 0);
    const pad = Math.max(4, Math.round(Math.max(x1 - x0, y1 - y0) * 0.04)); // recorta al producto con margen
    const cx = Math.max(0, x0 - pad), cy = Math.max(0, y0 - pad);
    const cw = Math.min(W, x1 + pad + 1) - cx, ch = Math.min(H, y1 + pad + 1) - cy;
    const k = Math.min(1, MAX / Math.max(cw, ch));
    const fw = Math.max(1, Math.round(cw * k)), fh = Math.max(1, Math.round(ch * k));
    const fc = document.createElement("canvas"); fc.width = fw; fc.height = fh;
    const fx = fc.getContext("2d")!;
    fx.fillStyle = "#fff"; fx.fillRect(0, 0, fw, fh);
    fx.imageSmoothingEnabled = true; fx.imageSmoothingQuality = "high";
    fx.drawImage(oc, cx, cy, cw, ch, 0, 0, fw, fh);
    return { blob: await canvasABlob(fc), removed: true };
  } finally {
    if (!(src instanceof ImageBitmap)) bmp.close();
  }
}

/** Convierte un data URI (del HTML antiguo) a Blob sin pasar por canvas. */
export function dataUriABlob(uri: string): Blob {
  const m = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(uri);
  if (!m) throw new Error("Data URI inválido");
  const tipo = m[1];
  if (!m[2]) return new Blob([decodeURIComponent(m[3])], { type: tipo });
  const bin = atob(m[3]);
  const a = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  return new Blob([a], { type: tipo });
}

export const MENSAJE_FONDO_FALLO =
  "⚠️ No pude separar el fondo de la foto (no es parejo), así que la dejé completa. Prueba con una foto sobre fondo liso o sube la sensibilidad.";
