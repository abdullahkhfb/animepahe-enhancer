import { h } from "../dom.js";

export function GroupChips({ groups, onSelect }) {
  const chips = new Map();
  const el = h(
    "div",
    { class: "chips", role: "group", "aria-label": "Setting groups" },
    groups.map((g) => {
      const dot = h("span", { class: "chip-dot", hidden: true, title: "Unapplied changes" });
      const btn = h("button", { type: "button", class: "chip", title: g.full ?? g.title, "aria-pressed": "false", onClick: () => select(g.id) }, g.title, dot);
      chips.set(g.id, { btn, dot });
      return btn;
    }),
  );

  function select(id) {
    for (const [gid, { btn }] of chips) btn.setAttribute("aria-pressed", String(gid === id));
    onSelect(id);
  }
  el.select = select;
  el.setDirty = (id, dirty) => (chips.get(id).dot.hidden = !dirty);
  return el;
}
