import { lineIcon, path, s } from "./svg.js";

export function ScheduleIcon(opts) {
  return lineIcon(
    opts,
    s("rect", { x: 4, y: 5, width: 16, height: 15, rx: 2.5 }),
    path("M4 10h16"),
    path("M9 3v4"),
    path("M15 3v4"),
  );
}
