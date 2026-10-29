import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { DUR, EASE } from '../lib/motion';

// Text surfaces the way an image does in the developer: act titles rise out of their line
// masks, copy comes up line by line from blank paper, and archive prints are slid onto
// the table one at a time. Every reveal plays once, when its act arrives, then the split
// is undone so the text is plain DOM again.

const splits: SplitText[] = [];
const triggers: ScrollTrigger[] = [];

function once(trigger: Element, start: string, play: () => gsap.core.Animation): void {
  const anim = play().pause();
  triggers.push(ScrollTrigger.create({ trigger, start, once: true, onEnter: () => anim.play() }));
}

export function init(reduced: boolean): void {
  if (reduced) return;

  document.querySelectorAll<HTMLElement>('main section:not(#safelight) h2.display').forEach((h) => {
    const split = SplitText.create(h, { type: 'lines', mask: 'lines', linesClass: 'line', aria: 'none' });
    splits.push(split);
    once(h, 'top 82%', () =>
      gsap.from(split.lines, { yPercent: 105, duration: DUR.long, ease: EASE.reveal, stagger: 0.1, onComplete: () => split.revert() }),
    );
  });

  document.querySelectorAll<HTMLElement>('[data-develop-text]').forEach((p) => {
    const split = SplitText.create(p, { type: 'lines', linesClass: 'line', aria: 'none' }); // aria-label isn't valid on <p>
    splits.push(split);
    once(p, 'top 85%', () =>
      gsap.from(split.lines, {
        opacity: 0,
        duration: DUR.long * 1.2,
        ease: 'power2.out',
        stagger: 0.14,
        delay: 0.25,
        onComplete: () => split.revert(), // back to normal text flow: resizes reflow freely
      }),
    );
  });

  const prints = document.querySelectorAll<HTMLElement>('.archive__item');
  if (prints.length) {
    once(prints[0], 'top 88%', () =>
      gsap.from(prints, {
        clipPath: 'inset(0 0 100% 0)',
        y: 40,
        duration: DUR.long,
        ease: EASE.reveal,
        stagger: 0.12,
        clearProps: 'clipPath,transform',
      }),
    );
  }
}

export function destroy(): void {
  triggers.splice(0).forEach((t) => t.kill());
  splits.splice(0).forEach((s) => s.revert());
}
