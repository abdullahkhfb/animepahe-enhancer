import { h } from "../dom.js";

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
