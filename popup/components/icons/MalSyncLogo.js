import { h } from "../dom.js";

/** The real MalSync logo (icons/malsync.svg), straight from the repository. */
export function MalSyncLogo({ size = 26 } = {}) {
  return h("img", {
    class: "malsync-logo",
    src: "../icons/malsync.svg",
    alt: "",
    width: size,
    height: size,
  });
}
