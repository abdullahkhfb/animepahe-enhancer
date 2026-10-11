import { h } from "../dom.js";

/**
 * One segment per feature, lit in that feature's colour while it's on —
 * an at-a-glance status strip styled like a video timeline.
 *
 * @param {{id: string, color: string, weight: number}[]} features
 */
export function Timeline(features) {
  const segs = new Map();
  const readout = h("span", {});
  const bar = h(
    "div",
    { class: "timeline__bar", "aria-hidden": "true" },
    features.map((f) => {
      const seg = h("div", { class: "timeline__seg" });
      seg.style.flexGrow = f.weight;
      seg.style.setProperty("--c", f.color);
      segs.set(f.id, seg);
      return seg;
    }),
  );
  const el = h("div", { class: "timeline" }, bar, h("div", { class: "timeline__readout" }, readout));

  /** @param {Record<string, boolean>} states feature id → enabled */
  el.update = (states) => {
    let n = 0;
    for (const f of features) {
      const on = !!states[f.id];
      segs.get(f.id).classList.toggle("is-on", on);
      if (on) n++;
    }
    readout.textContent = `${n} of ${features.length} active`;
  };
  return el;
}
