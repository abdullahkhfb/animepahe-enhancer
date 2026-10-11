import { h } from "../dom.js";

/** Mono pill showing a cache size or status, e.g. "18 cached". */
export function StatChip(text = "") {
  return h("span", { class: "stat-chip" }, text);
}
