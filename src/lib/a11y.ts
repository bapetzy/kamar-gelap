// Modal layer helpers. The page behind goes inert (no focus, hidden from assistive tech),
// focus moves into the layer, and returns to whatever opened it.

export function openModal(layer: HTMLElement, background: HTMLElement, focusTarget: HTMLElement): void {
  background.inert = true;
  layer.hidden = false;
  document.documentElement.classList.add('has-modal');
  focusTarget.focus({ preventScroll: true });
}

export function closeModal(layer: HTMLElement, background: HTMLElement, returnTo: HTMLElement | null): void {
  layer.hidden = true;
  background.inert = false;
  document.documentElement.classList.remove('has-modal');
  returnTo?.focus({ preventScroll: true });
}

/** Esc closes; returns the remover. */
export function onEscape(fn: () => void): () => void {
  const handler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') fn();
  };
  document.addEventListener('keydown', handler);
  return () => document.removeEventListener('keydown', handler);
}
