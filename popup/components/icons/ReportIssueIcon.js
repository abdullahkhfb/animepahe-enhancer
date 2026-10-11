import { lineIcon, path } from "./svg.js";

/** Warning triangle — the issue tracker link. */
export function ReportIssueIcon(opts) {
  return lineIcon({ size: 18, ...opts }, path("M12 4l9 16H3z"), path("M12 10v4M12 17v.01"));
}
