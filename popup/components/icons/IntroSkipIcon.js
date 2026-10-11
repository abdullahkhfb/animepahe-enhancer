import { lineIcon, path } from "./svg.js";

/** Skip-forward: a play triangle ending on a bar. */
export function IntroSkipIcon(opts) {
  return lineIcon(opts, path("M5 6l9 6-9 6z"), path("M18.5 6v12"));
}
