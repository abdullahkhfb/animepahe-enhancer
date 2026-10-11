import { h } from "../dom.js";

/**
 * Segmented tab bar. Panels are toggled by the caller through onSelect.
 * @param {{tabs: {id: string, label: string}[], onSelect: (id: string) => void}} opts
 */
export function Tabs({ tabs, onSelect }) {
  const buttons = tabs.map((t) =>
    h("button", {
      type: "button",
      class: "tabs__btn",
      role: "tab",
      id: `tab-${t.id}`,
      "aria-controls": `panel-${t.id}`,
      "aria-selected": "false",
      onClick: () => select(t.id),
    }, t.label),
  );
  const el = h("nav", { class: "tabs", role: "tablist", "aria-label": "Popup sections" }, buttons);

  function select(id) {
    tabs.forEach((t, i) => buttons[i].setAttribute("aria-selected", String(t.id === id)));
    onSelect(id);
  }
  el.select = select;
  return el;
}
