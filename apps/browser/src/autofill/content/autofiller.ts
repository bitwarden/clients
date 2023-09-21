if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", loadAutofiller);
} else {
  loadAutofiller();
}

function loadAutofiller() {
  let pageHref: string = null;
  let filledThisHref = false;
  let delayFillTimeout: number;

  const activeUserIdKey = "activeUserId";
  let activeUserId: string;

  chrome.storage.local.get(activeUserIdKey, (obj: any) => {
    if (obj == null || obj[activeUserIdKey] == null) {
      return;
    }
    activeUserId = obj[activeUserIdKey];
  });

  chrome.storage.local.get(activeUserId, (obj: any) => {
    if (obj?.[activeUserId]?.settings?.enableAutoFillOnPageLoad === true) {
      setInterval(() => doFillIfNeeded(), 500);
    }
  });
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.command === "fillForm" && pageHref === msg.url) {
      filledThisHref = true;
    }
  });

  function doFillIfNeeded(force = false) {
    if (force || pageHref !== window.location.href) {
      if (!force) {
        // Some websites are slow and rendering all page content. Try to fill again later
        // if we haven't already.
        filledThisHref = false;
        if (delayFillTimeout != null) {
          window.clearTimeout(delayFillTimeout);
        }
        delayFillTimeout = window.setTimeout(() => {
          if (!filledThisHref) {
            doFillIfNeeded(true);
          }
        }, 1500);
      }

      pageHref = window.location.href;
      const msg: any = {
        command: "bgCollectPageDetails",
        sender: "autofiller",
      };

      chrome.runtime.sendMessage(msg);
    }
  }
}
