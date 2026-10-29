// Regenerates the strip, archive and hero film markup in index.html from src/data/frames.ts.
// Run after editing frames.ts: npm run sync:frames
import fs from 'node:fs';
const src = fs.readFileSync('src/data/frames.ts', 'utf8');
// pull rows out of frames.ts so the static HTML can never drift from the data
const rows = [...src.matchAll(/title: '([^']+)',\s*time: '([^']+)',\s*line: '([^']+)',\s*alt: '([^']+)',\s*aperture: '([^']+)',\s*seconds: (\d+),\s*credit: '([^']+)',\s*w: (\d+),\s*h: (\d+)/g)]
  .map((m, i) => ({ no: String(i + 1).padStart(2, '0'), title: m[1], time: m[2], line: m[3], alt: m[4], ap: m[5], s: m[6], credit: m[7], w: m[8], h: m[9] }));
if (rows.length !== 6) throw new Error('expected 6 rows, got ' + rows.length);
const ar = (r) => `--ar: ${r.w} / ${r.h}`;
const img = (r, extra = '') => `<img src="/frames/${r.no}.webp" alt="${r.alt}" width="${r.w}" height="${r.h}"${extra} decoding="async" data-frame="${+r.no}" />`;
const strip = rows.map((r) => `            <li class="print" style="${ar(r)}"><figure tabindex="0"><span class="print__clip" aria-hidden="true"></span><div class="frame">${img(r, ' loading="lazy"')}</div><figcaption class="label"><span>Frame ${r.no} · ${r.time}</span> <span>${r.ap} · ${r.s}s</span> <span class="print__title">${r.title}</span></figcaption></figure></li>`).join('\n');
const archive = rows.map((r) => `          <li><button class="archive__item" type="button" aria-haspopup="dialog" data-frame="${+r.no}"><span class="frame" style="${ar(r)}">${img(r, ' loading="lazy"')}</span><span class="label">${r.no} · ${r.time} — ${r.title}</span></button></li>`).join('\n');
const film = rows.map((r) => `            <img src="/frames/${r.no}.webp" alt="" width="${r.w}" height="${r.h}" decoding="async" />`).join('\n');
const credits = rows.map((r) => r.credit).join(', ');
let html = fs.readFileSync('index.html', 'utf8');
const swap = (start, end, body) => {
  const a = html.indexOf(start), b = html.indexOf(end, a);
  if (a < 0 || b < 0) throw new Error('anchor missing: ' + start);
  html = html.slice(0, a + start.length) + '\n' + body + '\n' + html.slice(b);
};
swap('<ol class="strip__track">', '          </ol>', strip);
swap('<ol class="archive__grid">', '        </ol>', archive);
swap('<div class="filmstrip__frames">', '          </div>', film);
html = html.replace(/<span data-credits>[^<]*<\/span>/, `<span data-credits>Foto: ${credits} — Unsplash</span>`);
fs.writeFileSync('index.html', html);
console.log('ok', rows.map((r) => r.no + ' ' + r.title).join(' | '));
