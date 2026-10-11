import { lineIcon, path } from "./svg.js";

/** A queue with a play arrow — the next episode is lined up. */
export function BingeWatchIcon(opts) {
  return lineIcon(opts, path("M4 6h11M4 11h7M4 16h5"), path("M14.5 12.5l5.5 3.75-5.5 3.75z"));
}
