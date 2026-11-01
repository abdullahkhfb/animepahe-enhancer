import { h } from "../dom.js";

export function StatChip(text = "") {
  return h("span", { class: "stat-chip" }, text);
}
