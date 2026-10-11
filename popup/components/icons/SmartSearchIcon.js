import { lineIcon, path, circle } from "./svg.js";

/** Magnifier with a plus — search that finds more. */
export function SmartSearchIcon(opts) {
  return lineIcon(opts, circle(10.5, 10.5, 6), path("M15 15l5 5M10.5 8v5M8 10.5h5"));
}
