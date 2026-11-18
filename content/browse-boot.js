(() => {
  try {
    const route = /^#(browse|schedule)/.exec(location.hash)?.[1];
    if (!/^\/anime\/?$/i.test(location.pathname) || !route) return;
    const settingKey = route === "schedule" ? "scheduleEnabled" : "browseEnabled";

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
    // Never leave the page hidden if Browse or Schedule can't take over.
    setTimeout(release, 6000);
    chrome.storage.local.get("ape_settings").then((r) => {
      if (r?.ape_settings?.[settingKey] === false) release();
    });
  } catch {
    /* ignore */
  }
})();
