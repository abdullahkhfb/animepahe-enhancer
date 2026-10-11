import { lineIcon, path } from "./svg.js";

/** </> — the GitHub repository link. */
export function SourceCodeIcon(opts) {
  return lineIcon({ size: 18, ...opts }, path("M8 7l-5 5 5 5M16 7l5 5-5 5M13.5 5l-3 14"));
}
