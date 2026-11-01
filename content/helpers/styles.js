export function injectStylesheet(id, path) {
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = chrome.runtime.getURL(path);
  (document.head || document.documentElement).appendChild(link);
}
