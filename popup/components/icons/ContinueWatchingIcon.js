import { lineIcon, path, circle } from "./svg.js";

/** Play button inside a clock ring — "pick up where you left off". */
export function ContinueWatchingIcon(opts) {
  return lineIcon(opts, circle(12, 12, 8.5), path("M10.5 8.8l4.2 3.2-4.2 3.2z"));
}
