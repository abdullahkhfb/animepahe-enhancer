import { h } from "../dom.js";

export function MalSyncLogo({ size = 26 } = {}) {
  return h("img", {
    class: "malsync-logo",
    src: "../icons/malsync.svg",
    alt: "",
    width: size,
    height: size,
  });
}
