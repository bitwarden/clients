/**
 * This script handles injection of the LP suppress import download script into the document.
 * This is required for manifest v2, but will be removed when we migrate fully to manifest v3.
 */
(function (globalContext) {
  const script = globalContext.document.createElement("script");
  script.src = chrome.runtime.getURL("content/lp-suppress-import-download.js");
  globalContext.document.documentElement.appendChild(script);
})(window);
