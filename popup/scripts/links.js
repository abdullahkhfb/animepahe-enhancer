export function initLinksTab() {
  document.querySelectorAll("#panel-links .link-row").forEach((link) => {
    link.addEventListener("click", (e) => {
      if (!chrome?.tabs?.create) return; // fall back to default <a> behavior
      e.preventDefault();
      chrome.tabs.create({ url: link.href });
      window.close();
    });
  });
}
