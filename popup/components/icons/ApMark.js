import { s } from "./svg.js";

// A thin "a" beside a heavy "p" whose counter is a play button. The thin
// vs. bold contrast is borrowed from the animepahe wordmark.
const P_PATH =
  "M62 42 H84 A20 20 0 0 1 84 82 H80 V104 H62 Z M84.42 52.77 L84.42 52.77 Q82.00 51.00 82.00 54.00 L82.00 70.00 Q82.00 73.00 84.42 71.23 L94.58 63.77 Q97.00 62.00 94.58 60.23 Z";

/** The extension's logo tile (magenta, white letters). */
export function ApMark({ size = 38 } = {}) {
  return s(
    "svg",
    { viewBox: "0 0 128 128", width: size, height: size, role: "img", "aria-label": "animepahe Enhancer" },
    s("rect", { width: 128, height: 128, rx: 28, fill: "#d5015b" }),
    s(
      "g",
      { transform: "translate(3 -9)" },
      s("circle", { cx: 34, cy: 64, r: 14, fill: "none", stroke: "#fff", "stroke-width": 4.5 }),
      s("rect", { x: 46, y: 48, width: 4.5, height: 33, fill: "#fff" }),
      s("path", { d: P_PATH, fill: "#fff", "fill-rule": "evenodd" }),
    ),
  );
}
