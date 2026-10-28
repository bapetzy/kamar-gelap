import '@fontsource-variable/bodoni-moda/opsz.css';
import '@fontsource-variable/bodoni-moda/opsz-italic.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/acts.css';
import { getMode, onMode, setMode } from './lib/mode';

// A missing negative must never block the page: show an empty sheet of paper instead.
function markMissingFrames(): void {
  document.querySelectorAll<HTMLImageElement>('img[data-frame]').forEach((img) => {
    const markMissing = () => img.closest('.frame')?.classList.add('is-missing');
    if (img.complete && img.naturalWidth === 0) markMissing();
    else img.addEventListener('error', markMissing, { once: true });
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

markMissingFrames();
if (import.meta.env.DEV) mountDevToggle();
