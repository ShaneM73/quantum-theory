// Tiny DOM helpers for the lab panels.
export const $ = id => document.getElementById(id);

// Segmented control: buttons with data-v; calls onChange(value). Returns a setter.
export function segmented(id, onChange) {
  const root = $(id);
  const set = v => root.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === v)));
  root.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    set(b.dataset.v); onChange(b.dataset.v);
  });
  return set;
}

export const deg = x => `${(+x).toFixed(1).replace(/\.0$/, '')}°`;

export function loop(fn) {
  let last = performance.now();
  const step = now => { const dt = Math.min(0.05, (now - last) / 1000); last = now; fn(dt, now); requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
