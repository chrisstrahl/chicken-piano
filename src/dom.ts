// Small helpers for putting things on the page.

// Text that came from outside the app's own code (a typed name, a backup file, a song file) goes through
// this before it is placed into HTML, so it can only ever be text.
const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (t: unknown): string => String(t ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

// (Re)starts the CSS animation that class `cls` gives `el`. The usual trick (take the class off, ask the
// element for its size, put it back) makes the browser lay out the page on every note; here a second class
// swaps the animation for its twin of another name ("again" rules in index.html), which restarts it for free.
export function replay(el: Element, cls: string) {
  if (el.classList.contains(cls)) el.classList.toggle('again');
  else el.classList.add(cls);
}
