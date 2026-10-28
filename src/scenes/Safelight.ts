import { gsap } from 'gsap';
import { SplitText } from 'gsap/SplitText';
import type { Stage } from '../gl/Stage';
import { DUR, EASE } from '../lib/motion';

// Act I. The safelight is a lamp in your hand: the glow trails the pointer (or finger).
// The title surfaces once, line by line, like letters lifting out of the dark.

let split: SplitText | null = null;
let section: HTMLElement | null = null;
let stageRef: Stage | null = null;

const onPointer = (e: PointerEvent) => stageRef?.setGlowTarget(e.clientX, e.clientY);
const onTouch = (e: TouchEvent) => {
  const t = e.touches[0];
  if (t) stageRef?.setGlowTarget(t.clientX, t.clientY);
};

export function init(stage: Stage | null): void {
  section = document.querySelector<HTMLElement>('#safelight');
  const title = section?.querySelector<HTMLElement>('[data-reveal]');
  if (!section || !title) return;

  stageRef = stage;
  if (stage) {
    stage.watch(section);
    window.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('touchstart', onTouch, { passive: true });
    window.addEventListener('touchmove', onTouch, { passive: true });
  }

  split = SplitText.create(title, {
    type: 'lines',
    mask: 'lines',
    linesClass: 'line',
    autoSplit: true,
    onSplit(self) {
      gsap.set(title, { visibility: 'visible' });
      // Returned tween is re-synced by autoSplit on resize, so the reveal still plays once.
      return gsap.from(self.lines, {
        yPercent: 105,
        duration: DUR.long,
        ease: EASE.reveal,
        stagger: 0.12,
        delay: 0.2,
      });
    },
  });
}

export function destroy(): void {
  window.removeEventListener('pointermove', onPointer);
  window.removeEventListener('touchstart', onTouch);
  window.removeEventListener('touchmove', onTouch);
  if (section) stageRef?.unwatch(section);
  split?.revert();
  split = null;
  section = null;
  stageRef = null;
}
