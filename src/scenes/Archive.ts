import { gsap } from 'gsap';
import { Flip } from 'gsap/Flip';
import type Lenis from 'lenis';
import { frames, pad2 } from '../data/frames';
import { closeModal, onEscape, openModal } from '../lib/a11y';
import { DUR, EASE } from '../lib/motion';

// Act V. Lights on: the roll laid out as true black-and-white prints. Picking one up
// carries it (GSAP Flip) to a full view with its exposure notes; Esc puts it back.

type Field = 'no' | 'title' | 'aperture' | 'seconds' | 'credit' | 'prev' | 'next' | 'close';

let items: HTMLButtonElement[] = [];
let detail: HTMLElement | null = null;
let main: HTMLElement | null = null;
let media: HTMLElement;
let img: HTMLImageElement;
let backdrop: HTMLElement;
let meta: HTMLElement;
let field: Record<Field, HTMLElement>;
let current = -1;
let busy = false;
let reduced = false;
let lenisRef: Lenis | null = null;
const cleanups: Array<() => void> = [];

const gridFrame = (i: number) => items[i].querySelector<HTMLElement>('.frame')!;

function listen(el: EventTarget, type: string, fn: EventListener): void {
  el.addEventListener(type, fn);
  cleanups.push(() => el.removeEventListener(type, fn));
}

function fill(i: number): void {
  const f = frames[i];
  current = i;
  field.no.textContent = `Frame ${pad2(f.no)} / ${pad2(frames.length)}`;
  field.title.textContent = f.title;
  field.aperture.textContent = f.aperture;
  field.seconds.textContent = `${f.seconds}s`;
  field.credit.textContent = f.credit;
  media.classList.remove('is-missing');
  // Use the grid copy's size when it is already decoded, so Flip measures the final shape.
  const known = gridFrame(i).querySelector('img');
  const ar = known?.naturalWidth ? known.naturalWidth / known.naturalHeight : 0.8;
  media.style.setProperty('--ar', String(ar));
  img.src = f.src;

  // Only one grid print and the detail frame share the Flip id at a time.
  items.forEach((_, j) => delete gridFrame(j).dataset.flipId);
  gridFrame(i).dataset.flipId = media.dataset.flipId = 'print';
}

function open(i: number): void {
  if (busy || !detail || !main) return;
  busy = true;
  fill(i);
  lenisRef?.stop();
  const from = Flip.getState(gridFrame(i));
  openModal(detail, main, field.close);
  const done = () => (busy = false);

  if (reduced) {
    gsap.fromTo(detail, { opacity: 0 }, { opacity: 1, duration: DUR.short, onComplete: done });
    return;
  }
  gsap.set([backdrop, meta], { opacity: 0 }); // opacity only: focus stays on close
  Flip.from(from, { targets: media, duration: DUR.mid, ease: EASE.move, onComplete: done });
  gsap.to(backdrop, { opacity: 1, duration: DUR.short, ease: EASE.move });
  gsap.to(meta, { opacity: 1, duration: DUR.short, ease: EASE.reveal, delay: DUR.short });
}

function close(): void {
  if (busy || !detail || detail.hidden || !main) return;
  busy = true;
  const item = items[current];
  const r = item.getBoundingClientRect();
  if (r.bottom < 0 || r.top > window.innerHeight) {
    // after prev/next the print's home may be off screen: move the page there, behind the backdrop
    const y = window.scrollY + r.top - (window.innerHeight - r.height) / 2;
    if (lenisRef) lenisRef.scrollTo(y, { immediate: true, force: true });
    else window.scrollTo(0, y);
  }
  const finish = () => {
    gsap.set([detail, backdrop, meta, media], { clearProps: 'all' });
    closeModal(detail!, main!, item);
    lenisRef?.start();
    busy = false;
  };

  if (reduced) {
    gsap.to(detail, { opacity: 0, duration: DUR.short, onComplete: finish });
    return;
  }
  gsap.to(meta, { opacity: 0, duration: DUR.short / 2 });
  gsap.to(backdrop, { opacity: 0, duration: DUR.mid, ease: EASE.move });
  Flip.fit(media, gridFrame(current), { duration: DUR.mid, ease: EASE.move, onComplete: finish });
}

/** Swap to the neighbouring print on the light table. */
function step(dir: 1 | -1): void {
  if (busy) return;
  const i = (current + dir + frames.length) % frames.length;
  if (reduced) return fill(i);
  busy = true;
  gsap.to([media, meta], {
    opacity: 0,
    duration: DUR.short / 2,
    ease: EASE.move,
    onComplete: () => {
      fill(i);
      gsap.to([media, meta], { opacity: 1, duration: DUR.short, ease: EASE.move, onComplete: () => (busy = false) });
    },
  });
}

export function init(lenis: Lenis | null, reducedMotion: boolean): void {
  detail = document.querySelector<HTMLElement>('#detail');
  main = document.querySelector('main');
  if (!detail || !main) return;
  lenisRef = lenis;
  reduced = reducedMotion;

  media = detail.querySelector<HTMLElement>('.detail__frame')!;
  img = media.querySelector('img')!;
  backdrop = detail.querySelector<HTMLElement>('.detail__backdrop')!;
  meta = detail.querySelector<HTMLElement>('.detail__meta')!;
  const keys: Field[] = ['no', 'title', 'aperture', 'seconds', 'credit', 'prev', 'next', 'close'];
  field = Object.fromEntries(
    keys.map((k) => [k, detail!.querySelector<HTMLElement>(`[data-detail="${k}"]`)!]),
  ) as Record<Field, HTMLElement>;

  // Missing negative: same empty sheet as the grid. Known size: match the photo's aspect.
  listen(img, 'error', () => media.classList.add('is-missing'));
  listen(img, 'load', () => media.style.setProperty('--ar', String(img.naturalWidth / img.naturalHeight)));

  items = [...document.querySelectorAll<HTMLButtonElement>('.archive__item')];
  items.forEach((btn, i) => listen(btn, 'click', () => open(i)));
  listen(field.prev, 'click', () => step(-1));
  listen(field.next, 'click', () => step(1));
  listen(field.close, 'click', close);
  cleanups.push(onEscape(close));
}

export function destroy(): void {
  cleanups.splice(0).forEach((fn) => fn());
  if (detail && main && !detail.hidden) closeModal(detail, main, null);
  items = [];
  detail = main = lenisRef = null;
  current = -1;
  busy = false;
}
