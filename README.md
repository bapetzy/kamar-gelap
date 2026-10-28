# Kamar Gelap

An interactive darkroom. The visitor develops a roll of six photos: scroll is time in the room. Safelight red, a developer tray, prints hung to dry, then the lights come on.

Every visual and every animation has to answer one question: *what is this in darkroom terms?* If it has no answer, it isn't in the site.

## Run

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # type-check (tsc) + production build into dist/
npm run preview   # serve dist/ on http://localhost:4173
```

Node 22.12 or newer (Vite 8).

### Dev-only URL flags

These work only under `npm run dev`. Production builds ignore them.

| Flag | Effect |
| --- | --- |
| `?reduced` | Forces the reduced-motion path (the browser setting is still honoured without it) |
| `?nogl` | Skips WebGL to exercise the static fallback |

There's also a **Mode** button (bottom right, dev only) that switches between safelight and daylight.

## Photos

Put six images in `public/frames/` as `01.webp` … `06.webp`. Portrait 4:5 works best; other aspects are cover-cropped in the grid and shown whole in the detail view. Titles, f-stops, exposure seconds and credit live in [`src/data/frames.ts`](src/data/frames.ts). The captions in `index.html` repeat that text so the page reads without JavaScript, so keep both in sync.

If a file is missing, nothing blocks: WebGL draws a procedural stand-in (sky, ridge, low sun, seeded per frame) and the DOM shows an empty sheet labelled `NO NEGATIVE`.

## The five acts

| Act | What happens | Where |
| --- | --- | --- |
| 0 Preloader | Black cover. The safelight tube strikes (three irregular flickers, 0.66s) while fonts and textures load, capped at 4s. Its CSS radial falloff matches the GL glow, so the hand-off is invisible. | `scenes/Preloader.ts` |
| I Safelight | Radial glow follows the pointer or finger like a hand-held lamp (lerp 0.08, frame-rate independent). Title rises once through SplitText line masks. | `scenes/Safelight.ts` |
| II Develop | Section pinned for 150% of the viewport. Scroll progress is development time (timer 00:00 → 01:30). The paper shader darkens each pixel from paper-white toward its tone; dark tones cross their threshold first, highlights last, with low-frequency noise for uneven development. Pointer over the tray = agitation: ripples from the last 8 points. | `scenes/Develop.ts`, `gl/shaders/paper.frag.glsl` |
| III Hang to dry | Strip pinned and moved sideways by scroll. Each print is a damped pendulum (k 120, damping 14, clamped ±8°) that leans against the wire's speed. Hover/focus raises a `uDevelop` uniform (more density and contrast). | `scenes/Strip.ts`, `gl/shaders/print.frag.glsl` |
| IV Lights on | Pull-cord `<button>`: drag past 60px or click / Enter / Space. Three irregular flickers, then the whole site switches to daylight tokens. Auto-triggers when the archive is reached without pulling. | `scenes/LightsOn.ts` |
| V Archive | Six true black-and-white prints in an asymmetric grid. A print opens into a full detail view with GSAP Flip; prev/next swap prints; Esc or Close flips it back home. | `scenes/Archive.ts` |

## Architecture

```
src/
  main.ts               boot order, Lenis ↔ ScrollTrigger, scene init
  data/frames.ts        roll metadata
  lib/mode.ts           the only global state: 'dark' | 'day'
  lib/motion.ts         eases, durations, reduced-motion + touch checks
  lib/a11y.ts           modal open/close (inert background, focus in/out), Esc
  gl/Stage.ts           one fixed WebGL canvas behind the DOM
  gl/shared.ts          shared uniforms, CSS-token sync, texture cache
  gl/shaders/*.glsl     imported with ?raw
  scenes/*.ts           one file per act, each exports init()/destroy()
  styles/               tokens, base, acts, strip (III–IV), layers (preloader, detail, fallbacks)
```

**One clock.** `gsap.ticker` drives everything, in this order: Lenis → ScrollTrigger (via Lenis' scroll event) → scene work (pendulum physics) → Stage render → after-render DOM writes. Each frame reads layout first and writes afterwards, so there's no forced reflow per frame.

**Stage.** One orthographic renderer in CSS pixels. It draws a fullscreen room quad (safelight glow and grain), then planes glued to DOM elements. A plane follows its element's bounding rect, or a custom layout function when the element is rotated (the swinging prints). The loop idles and the canvas hides when the tab is hidden or no WebGL section (I–IV) is on screen. DPR is capped at 1.5, or 1 on touch devices.

**Grain** lives inside every fragment shader (`common.glsl`), so there is no post-processing pass. It re-rolls 24 times a second, one sample per CSS pixel, tinted by the room light so it never adds an off-palette hue.

**Mode sync.** `setMode()` sets `data-mode` on `<html>`. CSS tokens switch, and Stage reads the same tokens back with `getComputedStyle` into shader uniforms, so DOM and GL change in the same frame. That's what makes the flicker work.

**Text** is always in the DOM, never in the canvas.

## Design tokens

| Mode | Token | Value | Contrast on bg |
| --- | --- | --- | --- |
| dark | `--bg` | `#0A0505` | |
| dark | `--text` | `#EE5A4C` | 5.98:1 |
| dark | `--safelight` / `--accent` | `#C8281C` | 3.64:1 (focus ring, non-text) |
| dark | `--safelight-dim` | `#3A0B07` | lines, empty paper |
| day | `--bg` | `#F1EDE4` | |
| day | `--text` | `#121010` | 16.23:1 |
| day | `--accent` | `#C8281C` | 4.76:1 |

The glow peak is held at a 28% mix, so `--text` over the brightest spot stays around 4.6:1.

## Accessibility and fallbacks

- **Reduced motion:**
  - no Lenis, no pins or scrub, no pendulum, no ripple
  - grain holds still and the tray shows the finished print
  - lights-on is instant
  - the archive detail cross-fades instead of flipping
  - acts cross-fade in as they arrive
- **No WebGL:** plain `<img>` prints. In the dark they are greyscale with a `--safelight` multiply layer, so they read as safelit paper; in daylight they show as plain B&W. Pins, timer, cord and archive still work.
- **Keyboard:**
  - every interaction is a button (cord, archive prints, detail nav)
  - strip prints are focusable, and tabbing to one scrolls the strip until it is centered
  - visible 2px `--accent` focus ring
- **Archive detail:** the page behind goes `inert`, focus moves to Close and returns to the print. Esc closes.
- **Mobile (≤768px):** same five acts, the glow follows touch, ripple is off, and the detail view stacks.

## Performance (measured)

Lighthouse 13.6, desktop preset, production build via `vite preview`, three runs:

| Performance | Accessibility | Best practices | SEO | FCP | LCP | TBT | CLS |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 100 | 100 | 100 | 100 | 0.2–0.3 s | 0.2–0.3 s | 0–30 ms | 0 |

Frame rate on the target laptop (Ryzen 7 5825U, integrated Radeon, D3D11 via ANGLE), production build, scripted continuous scroll through all acts:

| Viewport | Canvas pixels | I | II | III | IV | V |
| --- | --- | --- | --- | --- | --- | --- |
| 786×630 @1.25 | 983×788 | 60 | 60 | 60 | 60 | 60 |
| 1920×1080 @1.25 | 2400×1350 | 60 | 59 (4 frames > 20 ms) | 60 | 60 | 60 |

CLS is 0 because the content stays unrendered under the preloader cover until the fonts are in, so the font swap can't shift anything visible.

Known costs:
- The JS bundle is about 200 KB gzip, mostly three.js (`WebGLRenderer` pulls in most of its core). This triggers Vite's 500 KB chunk warning.
- Lighthouse reports about 89 KB of unused JS, also from three.js.

## Deploy

`vercel.json` pins the Vite build and sets long-lived cache headers: `/assets/*` is immutable, `/frames/*` is cached for a day with a week of stale-while-revalidate.

```bash
npx vercel        # preview
npx vercel --prod # production
```

## Credits

Bryan Paulo · Vite, TypeScript, GSAP (ScrollTrigger, SplitText, Flip), Lenis, Three.js · Bodoni Moda and IBM Plex Mono via Fontsource (OFL).
