const NS = "http://www.w3.org/2000/svg";

export function svg(size, shapes, { fill = "none", stroke = "currentColor", sw = 2.6 } = {}) {
  const el = document.createElementNS(NS, "svg");
  el.setAttribute("viewBox", "0 0 24 24");
  el.setAttribute("width", String(size));
  el.setAttribute("height", String(size));
  el.setAttribute("fill", fill);
  if (stroke !== "none") {
    el.setAttribute("stroke", stroke);
    el.setAttribute("stroke-width", String(sw));
    el.setAttribute("stroke-linecap", "round");
    el.setAttribute("stroke-linejoin", "round");
  }
  el.setAttribute("aria-hidden", "true");
  el.setAttribute("focusable", "false");
  for (const [tag, attrs] of shapes) {
    const child = document.createElementNS(NS, tag);
    for (const k in attrs) child.setAttribute(k, String(attrs[k]));
    el.appendChild(child);
  }
  return el;
}

export const micIcon = (size = 11) =>
  svg(size, [
    ["rect", { x: 9, y: 2, width: 6, height: 12, rx: 3 }],
    ["path", { d: "M5 11a7 7 0 0 0 14 0M12 18v4" }],
  ]);

export const checkIcon = (size = 10) =>
  svg(size, [["path", { d: "M5 12l5 5 9-10" }]], { sw: 3.5 });

export const playIcon = (size = 22) =>
  svg(size, [["path", { d: "M8 5.5v13l11-6.5z" }]], { fill: "currentColor", stroke: "none" });

export const closeIcon = (size = 12) =>
  svg(size, [["path", { d: "M6 6l12 12M18 6L6 18" }]], { sw: 3 });

export const skipIcon = (size = 12) =>
  svg(size, [
    ["path", { d: "M5 5l10 7-10 7z", fill: "currentColor" }],
    ["path", { d: "M19 5v14" }],
  ], { sw: 2.4 });

export const bingeIcon = (size = 12) =>
  svg(size, [
    ["path", { d: "M4 6h11M4 11h7M4 16h5" }],
    ["path", { d: "M14.5 12.5l5.5 3.75-5.5 3.75z" }],
  ], { sw: 2.4 });

export const waitIcon = (size = 12) =>
  svg(size, [["path", { d: "M4 6l7 6-7 6zM12.5 6l7 6-7 6z" }]], { sw: 2.4 });

const RING_LEN = 56.5;

export const countdownRing = (secondsLeft, total) => {
  const el = svg(22, [
    ["circle", { cx: 11, cy: 11, r: 9, stroke: "rgba(255,255,255,0.2)", "stroke-width": 2.5 }],
    [
      "circle",
      {
        cx: 11,
        cy: 11,
        r: 9,
        stroke: "#ff4d94",
        "stroke-width": 2.5,
        "stroke-dasharray": RING_LEN,
        "stroke-dashoffset": (RING_LEN * (1 - secondsLeft / total)).toFixed(1),
      },
    ],
  ]);
  el.setAttribute("viewBox", "0 0 22 22");
  return el;
};
