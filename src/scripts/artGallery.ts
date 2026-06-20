import { justifyRows } from '../lib/justify';

// Re-init on first load AND after every View Transition swap (astro:page-load
// fires in both). Without this, navigating TO /art via a transition would never
// run the gallery setup, and window-level listeners from a prior visit would
// leak. teardown() removes the only listeners attached to persistent objects
// (window); element listeners die with the swapped-out DOM.
let galleryTeardown: (() => void) | null = null;

function initArtGallery() {
  galleryTeardown?.();
  galleryTeardown = null;

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- gentle fade-in as each image decodes (no pop) ----------
// Mark a tile loaded once its <img> is ready; cached images resolve instantly.
function markLoaded(fig: HTMLElement) { fig.classList.add('is-loaded'); }
document.querySelectorAll<HTMLElement>('figure.tile').forEach((fig) => {
  const img = fig.querySelector('img');
  if (!img) { markLoaded(fig); return; }
  if (img.complete && img.naturalWidth > 0) markLoaded(fig);
  else {
    img.addEventListener('load', () => markLoaded(fig), { once: true });
    img.addEventListener('error', () => markLoaded(fig), { once: true });
  }
});

// ---------- justified photo rows ----------
const rowsEl = document.getElementById('photo-rows');
function buildRows() {
  if (!rowsEl) return;
  const tiles = Array.from(rowsEl.querySelectorAll<HTMLElement>('figure.tile'));
  if (!tiles.length) return;
  const ars = tiles.map((t) => parseFloat(t.dataset.ar || '1'));
  const W = rowsEl.clientWidth;
  const rows = justifyRows(ars, W, 340, 14);
  // clear flex fallback; lay out by absolute row grouping using wrappers
  rowsEl.style.display = 'flex';
  rowsEl.style.flexDirection = 'column';
  rowsEl.style.gap = '14px';
  // remove any prior row wrappers, re-append tiles into fresh rows
  rowsEl.querySelectorAll('.jrow').forEach((r) => r.remove());
  rows.forEach((row) => {
    const r = document.createElement('div');
    r.className = 'jrow';
    r.style.display = 'flex';
    r.style.gap = '14px';
    row.indices.forEach((i) => {
      const t = tiles[i];
      t.style.flex = '0 0 auto';
      t.style.width = ars[i] * row.height + 'px';
      t.style.height = row.height + 'px';
      r.appendChild(t);
    });
    rowsEl.appendChild(r);
  });
}
buildRows();
window.addEventListener('resize', buildRows, { passive: true });

// ---------- placard controller ----------
const placard = document.getElementById('art-placard');
const elK = placard?.querySelector('.pl-kicker') as HTMLElement;
const elT = placard?.querySelector('.pl-title') as HTMLElement;
const elY = placard?.querySelector('.pl-year') as HTMLElement;
const elD = placard?.querySelector('.pl-desc') as HTMLElement;
let curKey: string | null = null;

interface Card { key: string; kicker: string; title: string; year: string; desc: string; }
function setPlacard(card: Card, dark: boolean) {
  if (!placard) return;
  placard.classList.toggle('dark', dark);
  if (card.key === curKey) return;
  curKey = card.key;
  const apply = () => { elK.textContent = card.kicker; elT.textContent = card.title; elY.textContent = card.year; elD.textContent = card.desc; placard.classList.remove('fade'); };
  if (reduce) { apply(); return; }
  placard.classList.add('fade');
  setTimeout(apply, 150);
}

const photoRowsEl = document.getElementById('photo-rows');
const DEF: Card = {
  key: 'def',
  kicker: photoRowsEl?.dataset.defKicker || 'Photography',
  title: photoRowsEl?.dataset.defTitle || '',
  year: '',
  desc: photoRowsEl?.dataset.defNote || '',
};
const calBlocks = Array.from(document.querySelectorAll<HTMLElement>('.cal-block'));
function calCard(b: HTMLElement): Card {
  return { key: 'c' + b.dataset.i, kicker: b.dataset.kicker || '', title: b.dataset.title || '', year: b.dataset.year || '', desc: b.dataset.note || '' };
}
function photoCard(t: HTMLElement): Card {
  const note = t.dataset.note || '';
  return { key: 'p' + t.dataset.i, kicker: 'Photography', title: t.dataset.title || 'Untitled', year: '', desc: note || DEF.desc };
}

let hovering: HTMLElement | null = null;
const photoLabel = document.getElementById('photography');
function updatePlacard() {
  if (!photoLabel) return;
  const inPhoto = photoLabel.getBoundingClientRect().top < window.innerHeight * 0.45;
  if (inPhoto) {
    if (hovering) setPlacard(photoCard(hovering), true);
    else setPlacard(DEF, true);
  } else {
    let best = calBlocks[0]; let bestD = Infinity;
    calBlocks.forEach((b) => {
      const r = b.getBoundingClientRect();
      const c = Math.abs((r.top + r.bottom) / 2 - window.innerHeight / 2);
      if (c < bestD) { bestD = c; best = b; }
    });
    if (best) setPlacard(calCard(best), false);
  }
}
rowsEl?.addEventListener('pointerover', (e) => {
  const t = (e.target as HTMLElement).closest<HTMLElement>('figure.tile');
  if (t) { hovering = t; updatePlacard(); }
});
rowsEl?.addEventListener('pointerleave', () => { hovering = null; updatePlacard(); });

// ---------- scrollspy (TOC) ----------
const tocLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>('#art-toc a'));
const stops = tocLinks
  .map((a) => ({ a, el: document.getElementById(a.dataset.target || '') }))
  .filter((s): s is { a: HTMLAnchorElement; el: HTMLElement } => !!s.el);
function updateToc() {
  const ref = window.innerHeight * 0.4;
  let idx = 0;
  stops.forEach((s, i) => { if (s.el.getBoundingClientRect().top <= ref) idx = i; });
  if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) idx = stops.length - 1;
  stops.forEach((s, i) => s.a.classList.toggle('is-active', i === idx));
}

let ticking = false;
function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => { updatePlacard(); updateToc(); ticking = false; });
}
window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', onScroll, { passive: true });
updatePlacard();
updateToc();

// ---------- silent deep-zoom lightbox ----------
const lb = document.getElementById('art-lightbox') as HTMLDialogElement | null;
const lbImg = document.getElementById('lb-img') as HTMLImageElement | null;
let zx = 0, zy = 0, zs = 1, drag = false, px = 0, py = 0;
function tf() { if (lbImg) lbImg.style.transform = `translate(${zx}px,${zy}px) scale(${zs})`; }
function openLB(src: string, alt: string) {
  if (!lb || !lbImg) return;
  lbImg.src = src; lbImg.alt = alt; zs = 1; zx = 0; zy = 0; tf();
  lb.showModal();
}
function closeLB() { lb?.close(); }
document.querySelectorAll<HTMLElement>('[data-zoom]').forEach((el) => {
  el.addEventListener('click', () => openLB(el.dataset.zoom || '', el.dataset.alt || ''));
});
document.getElementById('lb-close')?.addEventListener('click', closeLB);
lb?.addEventListener('click', (e) => { if (e.target === lb) closeLB(); });
lb?.addEventListener('wheel', (e) => {
  e.preventDefault();
  if (!lbImg) return;
  const f = e.deltaY < 0 ? 1.12 : 0.89;
  const ns = Math.min(6, Math.max(1, zs * f));
  const r = lbImg.getBoundingClientRect();
  // transform-origin is 0 0, so r.left/r.top already include the current pan:
  // the image-local point under the cursor is (clientX - r.left) / zs. Keep it
  // pinned across the zoom: zx -= (clientX - r.left) * (k - 1).
  const mx = e.clientX - r.left;
  const my = e.clientY - r.top;
  const k = ns / zs;
  zx -= mx * (k - 1); zy -= my * (k - 1); zs = ns;
  if (zs === 1) { zx = 0; zy = 0; }
  tf();
}, { passive: false });
lbImg?.addEventListener('pointerdown', (e) => { if (zs <= 1) return; drag = true; px = e.clientX; py = e.clientY; lbImg.setPointerCapture(e.pointerId); e.stopPropagation(); });
lbImg?.addEventListener('pointermove', (e) => { if (!drag) return; zx += e.clientX - px; zy += e.clientY - py; px = e.clientX; py = e.clientY; tf(); });
lbImg?.addEventListener('pointerup', () => { drag = false; });

  // Dispose window-level listeners on the next swap (element listeners go away
  // with the swapped-out DOM, so only these need removing).
  galleryTeardown = () => {
    window.removeEventListener('resize', buildRows);
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onScroll);
  };
}

document.addEventListener('astro:page-load', initArtGallery);
