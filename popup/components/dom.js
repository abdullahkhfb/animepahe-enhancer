// ── Tiny DOM helpers ─────────────────────────────────────────────────────
// Every component builds its markup with h() so the popup stays plain
// HTML/CSS/JS — no framework, no build step.

/**
 * Creates an element.
 * `class`, `dataset`, `style` (object) and `onXxx` handlers get special
 * treatment; `true` becomes a bare attribute and `false`/null is skipped.
 */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value == null || value === false) continue;
    if (key === "class") el.className = value;
    else if (key === "dataset") Object.assign(el.dataset, value);
    else if (key === "style" && typeof value === "object")
      Object.assign(el.style, value);
    else if (key.startsWith("on") && typeof value === "function")
      el.addEventListener(key.slice(2).toLowerCase(), value);
    else el.setAttribute(key, value === true ? "" : String(value));
  }
  append(el, ...children);
  return el;
}

/** Appends strings, nodes and (nested) arrays, skipping null/false. */
export function append(el, ...children) {
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    el.append(child);
  }
  return el;
}

/** Removes every child of `el`. */
export function clear(el) {
  el.replaceChildren();
  return el;
}
