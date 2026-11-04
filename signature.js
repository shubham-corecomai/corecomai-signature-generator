// Draws the animated CoreCom AI email signature on a 680 x 200 canvas (2x of the 340 x 100 GIF).
// Frame `null` is the finished signature; frames 0..T-1 are the build animation.

export const CW = 680;
export const CH = 200;

const YELLOW = [254, 198, 21];
const INK = [0, 0, 0];
const GREY = [71, 71, 71];
const TEXT = [23, 23, 23];
const DIVIDER = [221, 221, 221];
const WHITE = [255, 255, 255];
const FONT = 'Arial, Helvetica, "Liberation Sans", sans-serif';

// mark tile (2x of the 96px tile)
const TS = 192;
const MARK_W = 150;
const BAR_H = 6;
const SHARDS = 6;
const SKEW = 0.36;
const SHARD_DY = 78;
const STAG = 2;
const LEN = 10;

// layout
const TILE_Y = 4;
const DIV_X = 216;
const COL_X = 240;
const NAME_Y = 14;
const COL_W = 430;
const PAD = 9;
const FADE = [0.4, 0.75, 0.95];

const clamp = (v) => Math.max(0, Math.min(1, v));
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const lerp = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;

/** Measures the text and picks font sizes that keep everything inside the right-hand column. */
export function makeLayout(ctx, data) {
  const name = data.name.trim();
  const role = data.role.trim();
  const maxW = COL_W - 8;

  const widthAt = (text, weight, size) => {
    ctx.font = `${weight} ${size}px ${FONT}`;
    return ctx.measureText(text).width;
  };
  const fitSize = (width, base, min) => (width > maxW ? Math.max(min, Math.floor((base * maxW) / width)) : base);

  const nameSize = fitSize(widthAt(name, 'bold', 34), 34, 20);
  const nameX = [...name].map((_, i) => widthAt(name.slice(0, i), 'bold', nameSize));

  const lead = `${role}, `;
  const roleBase = widthAt(lead, 'normal', 24) + widthAt('CoreCom AI', 'bold', 24) + 2 * PAD;
  const roleSize = fitSize(roleBase, 24, 14);
  const leadW = widthAt(lead, 'normal', roleSize);
  const coW = widthAt('CoreCom AI', 'bold', roleSize);

  const lines = data.lines.map((text) => ({ text, size: fitSize(widthAt(text, 'normal', 26), 26, 16) }));
  const shim = name.length + 10;

  return { name, nameSize, nameX, lead, roleSize, leadW, coW, lines, shim, frames: 10 + shim + 14 };
}

function drawTile(ctx, mark, mh, progress, bar, alpha) {
  const ox = 0;
  const oy = TILE_Y;
  const mx = ox + (TS - MARK_W) / 2;
  const my = oy + (TS - BAR_H - mh) / 2;
  ctx.save();
  ctx.globalAlpha = alpha;
  if (!progress || progress.every((p) => p >= 1)) {
    ctx.drawImage(mark, mx, my, MARK_W, mh);
  } else {
    const sw = MARK_W / SHARDS;
    const bx = (i, y) => i * sw + SKEW * (y - mh / 2);
    progress.forEach((p, k) => {
      if (p <= 0) return;
      const e = easeOut(p);
      const dy = (k % 2 === 0 ? 1 : -1) * SHARD_DY * (1 - e);
      const left = k === 0 ? -10 : null;
      const right = k === SHARDS - 1 ? MARK_W + 10 : null;
      ctx.save();
      ctx.globalAlpha = alpha * e;
      ctx.beginPath();
      ctx.moveTo(mx + (left ?? bx(k, 0)), my + dy);
      ctx.lineTo(mx + (right ?? bx(k + 1, 0)), my + dy);
      ctx.lineTo(mx + (right ?? bx(k + 1, mh)), my + mh + dy);
      ctx.lineTo(mx + (left ?? bx(k, mh)), my + mh + dy);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(mark, mx, my + dy, MARK_W, mh);
      ctx.restore();
    });
  }
  if (bar > 0) {
    ctx.fillStyle = rgb(YELLOW);
    ctx.fillRect(ox, oy + TS - BAR_H, Math.round(TS * easeOut(bar)), BAR_H);
  }
  ctx.restore();
}

function drawName(ctx, L, shimmerF, reveal) {
  const x0 = COL_X + 2;
  ctx.textBaseline = 'alphabetic';

  // name, letter by letter so each letter can change colour and hop
  ctx.font = `bold ${L.nameSize}px ${FONT}`;
  [...L.name].forEach((ch, i) => {
    let color = INK;
    let dy = 0;
    if (shimmerF !== null) {
      const amt = Math.sin(Math.PI * clamp((shimmerF - i) / 10));
      color = lerp(INK, YELLOW, amt);
      dy = -Math.round(4 * amt);
    }
    ctx.fillStyle = rgb(color);
    ctx.fillText(ch, x0 + L.nameX[i], NAME_Y + 34 + dy);
  });

  // role: grey lead-in, then "CoreCom AI" on a yellow highlighter
  const base = NAME_Y + 68;
  ctx.font = `normal ${L.roleSize}px ${FONT}`;
  ctx.fillStyle = rgb(GREY);
  ctx.fillText(L.lead, x0, base);

  const chipL = x0 + L.leadW - 2;
  const chipW = PAD + L.coW + PAD;
  const xa = chipL + chipW * reveal[0];
  const xb = chipL + chipW * reveal[1];
  if (xb > xa) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(xa, NAME_Y + 44, xb - xa, 44);
    ctx.clip();
    ctx.fillStyle = rgb(YELLOW);
    ctx.fillRect(chipL, NAME_Y + 46, chipW, 30);
    ctx.font = `bold ${L.roleSize}px ${FONT}`;
    ctx.fillStyle = rgb(INK);
    ctx.fillText('CoreCom AI', chipL + PAD, base);
    ctx.restore();
  }
}

/** Draws one frame. f === null -> the finished signature; otherwise build frame f (0 .. L.frames - 1). */
export function drawSignature(ctx, mark, L, f) {
  const mh = Math.round((mark.height * MARK_W) / mark.width);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, CW, CH);

  let progress = null;
  let bar = 1;
  let tileAlpha = 1;
  let contact = L.lines.map(() => 1);
  if (f !== null) {
    if (f < 3) {
      tileAlpha = 1 - FADE[f];
      contact = L.lines.map(() => 1 - FADE[f]);
    } else {
      progress = Array.from({ length: SHARDS }, (_, k) => clamp((f - 3 - STAG * k) / LEN));
      bar = clamp((f - 9) / 14);
      contact = L.lines.map((_, k) => clamp((f - 8 - 3 * k) / 6));
    }
  }

  drawTile(ctx, mark, mh, progress, bar, tileAlpha);
  ctx.fillStyle = rgb(DIVIDER);
  ctx.fillRect(DIV_X, TILE_Y + 8, 2, TS - 16);

  // name block: colour wave through the name, then the highlighter wipes out and back in
  let shimmer = null;
  let reveal = [0, 1];
  if (f !== null) {
    const g = f - 10;
    if (g >= 0 && g < L.shim) shimmer = g;
    else if (g >= L.shim && g < L.shim + 6) reveal = [easeOut((g - L.shim + 1) / 6), 1];
    else if (g >= L.shim + 6 && g < L.shim + 14) reveal = [0, easeOut((g - L.shim - 5) / 8)];
  }
  drawName(ctx, L, shimmer, reveal);

  // contact lines, centred beside the mark
  const lastBase = 194 - 24 * (3 - L.lines.length);
  ctx.textBaseline = 'alphabetic';
  L.lines.forEach((line, k) => {
    if (contact[k] <= 0) return;
    ctx.font = `normal ${line.size}px ${FONT}`;
    ctx.fillStyle = rgb(lerp(WHITE, TEXT, contact[k]));
    ctx.fillText(line.text, COL_X + 2, lastBase - 32 * (L.lines.length - 1 - k));
  });
}
