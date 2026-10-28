// The only global state: is the room dark (safelight) or are the lights on?

export type Mode = 'dark' | 'day';
type Listener = (mode: Mode) => void;

let current: Mode = 'dark';
const listeners = new Set<Listener>();

export const getMode = (): Mode => current;

export function setMode(next: Mode): void {
  if (next === current) return;
  current = next;
  document.documentElement.dataset.mode = next;
  listeners.forEach((fn) => fn(next));
}

export function onMode(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
