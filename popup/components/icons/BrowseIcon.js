import { lineIcon, s } from "./svg.js";

export function BrowseIcon(opts) {
  const tile = (x, y) => s("rect", { x, y, width: 7, height: 7, rx: 1.6 });
  return lineIcon(opts, tile(4, 4), tile(13, 4), tile(4, 13), tile(13, 13));
}
