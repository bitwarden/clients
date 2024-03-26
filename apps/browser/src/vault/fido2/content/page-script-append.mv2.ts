/**
 * This script handles injection of the FIDO2 override page script into the document.
 * This is required for manifest v2, but will be removed when we migrate fully to manifest v3.
 */
import { Fido2ContentScript } from "../enums/fido2-content-script.enum";

(function (globalContext) {
  if (globalContext.document.contentType !== "text/html") {
    return;
  }

  const script = globalContext.document.createElement("script");
  script.src = chrome.runtime.getURL(Fido2ContentScript.PageScript);
  script.addEventListener("load", () => script.remove());

  const scriptInsertionPoint =
    globalContext.document.head || globalContext.document.documentElement;
  scriptInsertionPoint.insertBefore(script, scriptInsertionPoint.firstChild);
})(globalThis);
