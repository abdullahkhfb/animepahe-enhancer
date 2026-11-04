(() => {
  try {
    if (!/^\/anime\/?$/i.test(location.pathname) || !location.hash.startsWith("#browse")) return;

    const root = document.documentElement;
    root.classList.add("ape-br-boot");
    const style = document.createElement("style");
    style.id = "ape-br-boot-css";
    style.textContent =
      "html.ape-br-boot .index,html.ape-br-boot .content-wrapper h1,html.ape-br-boot .content-wrapper .title-wrapper,html.ape-br-boot main h1{visibility:hidden!important}";
    root.append(style);

    const release = () => {
      root.classList.remove("ape-br-boot");
      style.remove();
    };
    // Never leave the page hidden if Browse can't take over.
    setTimeout(release, 6000);
    chrome.storage.local.get("ape_settings").then((r) => {
      if (r?.ape_settings?.browseEnabled === false) release();
    });
  } catch {
    /* ignore */
  }
})();
