import { CW, CH, makeLayout, drawSignature } from './signature.js';
import { createGif } from './gif.js';

const $ = (id) => document.getElementById(id);
const form = $('form');
const statusEl = $('status');
const createBtn = $('create');
const live = $('live');
const liveCtx = live.getContext('2d');

const mark = new Image();
const markReady = new Promise((resolve, reject) => {
  mark.onload = resolve;
  mark.onerror = () => reject(new Error('Could not load assets/mark.png'));
});
mark.src = 'assets/mark.png';

let urls = [];

function readData() {
  const v = (id) => $(id).value.trim();
  const website = v('website').replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  return {
    name: v('name'),
    role: v('role'),
    email: v('email'),
    lines: [v('email'), v('phone'), v('phone2'), website].filter(Boolean),
  };
}

/** Returns { message, field } for the first problem, or null when everything is fine. */
function validate(data) {
  if (!data.name) return { message: 'Please enter your full name.', field: 'name' };
  if (!data.role) return { message: 'Please enter your job title.', field: 'role' };
  if (data.email && !/^\S+@\S+\.\S+$/.test(data.email)) {
    return { message: 'That email address does not look right.', field: 'email' };
  }
  if (data.lines.length === 0) {
    return { message: 'Add at least one contact line: email, phone or website.', field: 'phone' };
  }
  if (data.lines.length > 3) {
    return { message: 'A signature shows up to 3 contact lines. Clear one of the fields.', field: 'phone2' };
  }
  return null;
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle('error', isError);
}

function clearInvalid() {
  form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
}

function drawLive() {
  const data = readData();
  const preview = {
    name: data.name || 'Your Name',
    role: data.role || 'Your Job Title',
    lines: (data.lines.length ? data.lines : ['+91 98765 43210', 'corecomai.com']).slice(0, 3),
  };
  const L = makeLayout(liveCtx, preview);
  drawSignature(liveCtx, mark, L, null);
}

let queued = false;
function scheduleDraw() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    drawLive();
  });
}

const slug = (s) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'me';

function showResult(data, gif1x, gif2x) {
  urls.forEach((u) => URL.revokeObjectURL(u));
  const u1 = URL.createObjectURL(new Blob([gif1x], { type: 'image/gif' }));
  const u2 = URL.createObjectURL(new Blob([gif2x], { type: 'image/gif' }));
  urls = [u1, u2];
  const base = `corecomai-signature-${slug(data.name)}`;
  $('gif').src = u1;
  $('dl1').href = u1;
  $('dl1').download = `${base}.gif`;
  $('dl2').href = u2;
  $('dl2').download = `${base}-2x.gif`;
  const result = $('result');
  result.hidden = false;
  result.focus();
  result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

form.addEventListener('input', () => {
  clearInvalid();
  if (statusEl.classList.contains('error')) setStatus('');
  scheduleDraw();
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearInvalid();
  const data = readData();
  const problem = validate(data);
  if (problem) {
    setStatus(problem.message, true);
    const el = $(problem.field);
    el.setAttribute('aria-invalid', 'true');
    el.focus();
    return;
  }

  createBtn.disabled = true;
  setStatus('Building your signature…');
  try {
    await markReady;
    const { gif1x, gif2x } = await createGif(data, mark, (p) => setStatus(`Building your signature… ${Math.round(p * 100)}%`));
    showResult(data, gif1x, gif2x);
    setStatus('Done. Your GIF is ready below the preview.');
  } catch (err) {
    console.error(err);
    setStatus('Something went wrong while building the GIF. Please try again.', true);
  } finally {
    createBtn.disabled = false;
  }
});

markReady.then(drawLive).catch((err) => setStatus(err.message, true));
