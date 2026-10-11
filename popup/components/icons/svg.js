// ── SVG helpers shared by every icon component ───────────────────────────
const NS = "http://www.w3.org/2000/svg";

/** Creates an SVG element in the SVG namespace. */
export function s(tag, attrs = {}, ...children) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  for (const child of children.flat()) if (child) el.appendChild(child);
  return el;
}

/**
 * The 24×24 line-icon frame used by all feature/link icons: round caps,
 * `currentColor` stroke, decorative (aria-hidden) by default.
 */
export function lineIcon(
  { size = 20, strokeWidth = 1.8, viewBox = "0 0 24 24" } = {},
  ...children
) {
  return s(
    "svg",
    {
      viewBox,
      width: size,
      height: size,
      fill: "none",
      stroke: "currentColor",
      "stroke-width": strokeWidth,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      "aria-hidden": "true",
      focusable: "false",
    },
    ...children,
  );
}

export const path = (d) => s("path", { d });
export const circle = (cx, cy, r) => s("circle", { cx, cy, r });
