/**
 * This script handles injection of the FIDO2 override page script into the document.
 * This is required for manifest v2, but will be removed when we migrate fully to manifest v3.
 */
void (async function (globalContext) {
  if (globalContext.document.contentType !== "text/html") {
    return;
  }

  const script = globalContext.document.createElement("script");
  script.async = false;

  const pageScriptUrl = chrome.runtime.getURL("content/fido2-page-script.js");
  // Inject the script contents directly to avoid leaking the extension URL
  try {
    const response = await fetch(pageScriptUrl);
    const scriptContents = await response.text();
    script.innerHTML = scriptContents;
  } catch {
    // eslint-disable-next-line no-console
    console.error("Failed to load FIDO2 page script contents. Injection failed.");
    return;
  }

  // We are ensuring that the script injection is delayed in the event that we are loading
  // within an iframe element. This prevents an issue with web mail clients that load content
  // using ajax within iframes. In particular, Zimbra web mail client was observed to have this issue.
  // @see https://github.com/bitwarden/clients/issues/9618
  const delayScriptInjection =
    globalContext.window.top !== globalContext.window &&
    globalContext.document.readyState !== "complete";
  if (delayScriptInjection) {
    globalContext.document.addEventListener("DOMContentLoaded", injectScript);
  } else {
    injectScript();
  }

  function injectScript() {
    const scriptInsertionPoint =
      globalContext.document.head || globalContext.document.documentElement;
    scriptInsertionPoint.prepend(script);
  }
})(globalThis);
