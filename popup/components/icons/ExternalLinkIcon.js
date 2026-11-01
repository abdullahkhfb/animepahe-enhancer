import { lineIcon, path } from "./svg.js";

export function ExternalLinkIcon(opts) {
  return lineIcon({ size: 12, strokeWidth: 1.6, viewBox: "0 0 12 12", ...opts }, path("M3 9l6-6M4 3h5v5"));
}
