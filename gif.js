// Renders every frame of the signature and encodes it as GIF files (all in the browser, nothing is uploaded).
import { GIFEncoder, quantize, applyPalette } from './vendor/gifenc.esm.js';
import { CW, CH, makeLayout, drawSignature } from './signature.js';

const HOLD_FIRST_MS = 1200;
const STEP_MS = 40;
const HOLD_LAST_MS = 2600;
const LOOPS = 2; // plays about three times, then rests on the finished signature

// yields to the browser so the progress text can repaint (a timer, because animation frames pause in background tabs)
const nextPaint = () => new Promise((resolve) => setTimeout(resolve, 0));

function makeCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return { canvas, ctx: canvas.getContext('2d', { willReadFrequently: true }) };
}

/** Pins the palette entry closest to white to exact white, so the background never shows as a grey box. */
function pinWhite(palette) {
  let best = 0;
  let bestDist = Infinity;
  palette.forEach((c, i) => {
    const d = (255 - c[0]) ** 2 + (255 - c[1]) ** 2 + (255 - c[2]) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  });
  palette[best] = [255, 255, 255];
}

// Only the pixels that changed since the previous frame are stored; the rest are marked transparent and the
// previous frame is left in place. That keeps the files small. The first frame is always complete and opaque.
function encode(frames, width, height, palette, delays) {
  const gif = GIFEncoder();
  const same = palette.length; // extra palette slot meaning "unchanged pixel"; applyPalette never produces it
  const table = [...palette, [0, 0, 0]];
  let prev = null;
  frames.forEach((rgba, i) => {
    const index = applyPalette(rgba, palette, 'rgb565');
    let out = index;
    if (prev) {
      out = new Uint8Array(index.length);
      for (let p = 0; p < index.length; p++) out[p] = index[p] === prev[p] ? same : index[p];
    }
    prev = index;
    gif.writeFrame(out, width, height, {
      palette: i === 0 ? table : null,
      delay: delays[i],
      repeat: LOOPS,
      transparent: i > 0,
      transparentIndex: same,
      dispose: 1,
    });
  });
  gif.finish();
  return gif.bytes();
}

/**
 * @param {{name:string, role:string, lines:string[]}} data  1-3 contact lines
 * @param {HTMLImageElement} mark  the CC mark image
 * @returns {Promise<{gif1x:Uint8Array, gif2x:Uint8Array, frames:number}>}
 */
export async function createGif(data, mark, onProgress = () => {}) {
  const big = makeCanvas(CW, CH);
  const small = makeCanvas(CW / 2, CH / 2);
  small.ctx.imageSmoothingEnabled = true;
  small.ctx.imageSmoothingQuality = 'high';

  const L = makeLayout(big.ctx, data);
  const order = [null, ...Array.from({ length: L.frames }, (_, i) => i)];
  const delays = order.map((_, i) => (i === 0 ? HOLD_FIRST_MS : i === order.length - 1 ? HOLD_LAST_MS : STEP_MS));

  const frames2x = [];
  const frames1x = [];
  for (let i = 0; i < order.length; i++) {
    drawSignature(big.ctx, mark, L, order[i]);
    frames2x.push(big.ctx.getImageData(0, 0, CW, CH).data);
    small.ctx.clearRect(0, 0, CW / 2, CH / 2);
    small.ctx.drawImage(big.canvas, 0, 0, CW / 2, CH / 2);
    frames1x.push(small.ctx.getImageData(0, 0, CW / 2, CH / 2).data);
    if (i % 6 === 0) {
      onProgress((i / order.length) * 0.7);
      await nextPaint();
    }
  }

  // one shared palette (sampled from the 1x frames) keeps the files small and the colours stable
  const sample = frames1x.filter((_, i) => i % 3 === 0 || i === frames1x.length - 1);
  const merged = new Uint8ClampedArray(sample.reduce((n, f) => n + f.length, 0));
  let at = 0;
  sample.forEach((f) => {
    merged.set(f, at);
    at += f.length;
  });
  const palette = quantize(merged, 48, { format: 'rgb565' });
  pinWhite(palette);

  onProgress(0.8);
  await nextPaint();
  const gif1x = encode(frames1x, CW / 2, CH / 2, palette, delays);
  onProgress(0.92);
  await nextPaint();
  const gif2x = encode(frames2x, CW, CH, palette, delays);
  onProgress(1);
  return { gif1x, gif2x, frames: order.length };
}
