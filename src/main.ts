import '@fontsource-variable/bodoni-moda/opsz.css';
import '@fontsource-variable/bodoni-moda/opsz-italic.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/strip.css';
import './styles/acts.css';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';
import { Stage } from './gl/Stage';
import { getMode, onMode, setMode } from './lib/mode';
import * as Safelight from './scenes/Safelight';
import * as Develop from './scenes/Develop';
import * as Strip from './scenes/Strip';
import * as LightsOn from './scenes/LightsOn';

gsap.registerPlugin(ScrollTrigger, SplitText);

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
  markMissingFrames();
  if (import.meta.env.DEV) mountDevToggle();

  const lenis = startScroll();
  const stage = Stage.create();
  if (stage) document.documentElement.classList.add('has-gl');

  // Split lines and measure pins only once the real fonts are in.
  await document.fonts.ready;
  Safelight.init(stage);
  Develop.init(stage);
  Strip.init(stage, lenis);
  LightsOn.init(stage);
  stage?.start(); // after scenes, so their ticker work lands before the frame is drawn
  ScrollTrigger.refresh();
}

boot();
