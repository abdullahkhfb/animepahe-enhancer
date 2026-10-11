import { lineIcon, path } from "./svg.js";

/** Speech bubble with a voice waveform. */
export function DubDetectorIcon(opts) {
  return lineIcon(
    opts,
    path(
      "M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4 4v-4H6.5A2.5 2.5 0 0 1 4 13.5z",
    ),
    path("M9 9.5v2M12 8v5M15 9.5v2"),
  );
}
