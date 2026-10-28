import '@fontsource-variable/bodoni-moda/opsz.css';
import '@fontsource-variable/bodoni-moda/opsz-italic.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/strip.css';
import './styles/acts.css';
import './styles/layers.css';
import { gsap } from 'gsap';
import { Flip } from 'gsap/Flip';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';
import { Stage } from './gl/Stage';
import { getMode, onMode, setMode } from './lib/mode';
import { DUR, prefersReducedMotion } from './lib/motion';
import * as Preloader from './scenes/Preloader';
import * as Safelight from './scenes/Safelight';
import * as Develop from './scenes/Develop';
import * as Strip from './scenes/Strip';
import * as LightsOn from './scenes/LightsOn';
import * as Archive from './scenes/Archive';

gsap.registerPlugin(ScrollTrigger, SplitText, Flip);

// A missing negative must never block the page: show an empty sheet of paper instead.
function markMissingFrames(): void {
  document.querySelectorAll<HTMLImageElement>('img[data-frame]').forEach((img) => {
    const markMissing = () => img.closest('.frame')?.classList.add('is-missing');
    if (img.complete && img.naturalWidth === 0) markMissing();
    else img.addEventListener('error', markMissing, { once: true });
  });
}

// One clock for everything: Lenis, ScrollTrigger and the GL stage all run on gsap.ticker.
function startScroll(): Lenis {
  const lenis = new Lenis({ autoRaf: false });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  return lenis;
}

// Reduced motion: acts cross-fade in as they arrive instead of moving.
function crossfadeActs(): void {
  document.querySelectorAll<HTMLElement>('main > section:not(:first-child)').forEach((act) => {
    gsap.from(act, { autoAlpha: 0, duration: DUR.short, scrollTrigger: { trigger: act, start: 'top 85%' } });
  });
}

// Dev only: flip between safelight and daylight without walking through the acts.
function mountDevToggle(): void {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'dev-toggle label';
  const render = () => {
    btn.textContent = `Mode: ${getMode()}`;
    btn.setAttribute('aria-pressed', String(getMode() === 'day'));
  };
  btn.addEventListener('click', () => setMode(getMode() === 'dark' ? 'day' : 'dark'));
  onMode(render);
  render();
  document.body.append(btn);
}

async function boot(): Promise<void> {
  const reduced = prefersReducedMotion();
  const root = document.documentElement;
  if (reduced) root.classList.add('reduced');
  markMissingFrames();
  if (import.meta.env.DEV) mountDevToggle();

  // Dev only: `?nogl` exercises the no-WebGL fallback.
  const skipGl = import.meta.env.DEV && new URLSearchParams(location.search).has('nogl');
  const stage = skipGl ? null : Stage.create(reduced);
  if (stage) root.classList.add('has-gl');

  const lenis = reduced ? null : startScroll();
  lenis?.stop();

  // Tube strikes while fonts and negatives load (fonts also make line splits correct).
  await Preloader.run(Boolean(stage), reduced);
  root.classList.add('is-ready');

  Safelight.init(stage, reduced);
  Develop.init(stage, reduced);
  Strip.init(stage, lenis, reduced);
  LightsOn.init(stage, reduced);
  Archive.init(lenis, reduced);
  if (reduced) crossfadeActs();
  stage?.start(); // after scenes, so their ticker work lands before the frame is drawn
  ScrollTrigger.refresh();

  Preloader.exit(reduced);
  lenis?.start();
}

boot();
