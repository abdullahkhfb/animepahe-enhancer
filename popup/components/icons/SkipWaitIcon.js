import { lineIcon, path } from "./svg.js";

/** A fast-forward arrow — skip the countdown. */
export function SkipWaitIcon(opts) {
  return lineIcon(opts, path("M4 6l7 6-7 6z"), path("M12.5 6l7 6-7 6z"));
}
