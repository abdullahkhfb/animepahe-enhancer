import { h } from "../dom.js";

export function Timeline(features) {
  const segs = new Map();
  const readout = h("span", {});
  const bar = h(
    "div",
    { class: "timeline-bar", "aria-hidden": "true" },
    features.map((f) => {
      const seg = h("div", { class: "timeline-seg" });
      seg.style.flexGrow = f.weight;
      segs.set(f.id, seg);
      return seg;
    }),
  );
  const el = h("div", { class: "timeline" }, bar, h("div", { class: "timeline-readout" }, readout));

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
