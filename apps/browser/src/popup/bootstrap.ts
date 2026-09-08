import { POPUP_WIDTH_STORAGE_KEY, PopupWidthOptions } from "../platform/browser/popup-width";
import { applyCachedTheme } from "../platform/popup/theme/popup-theme-cache";

/**
 * Pre-bootstrap script for the popup.
 *
 * The popup's app bundles are ~7MB of JavaScript, and Chrome does not display the popup window
 * until the renderer produces a frame -- so while they compile and evaluate, clicking the
 * toolbar icon shows nothing at all. Painting the loading state first does not reduce
 * time-to-interactive, but it does mean the click is acknowledged.
 *
 * Two constraints:
 *
 * 1. It must stay dependency-free. Anything imported here lands on the critical path ahead of
 *    the first frame, which is the exact problem being solved.
 * 2. It is loaded as a parser-blocking script in `<head>`, so it must not touch `document.body`
 *    at top level -- the parser has not reached it yet. Being parser-blocking is the point:
 *    with no other blocking scripts left, Chrome will paint the loading state before a `defer`
 *    script gets to run, and the theme would be applied a frame too late.
 */

/**
 * Ceiling on how long to wait for the paint before loading the app anyway:
 * `requestAnimationFrame` does not fire while the document is render-blocked (a stylesheet
 * still in flight, say), so the rAF path alone could stall indefinitely.
 */
const PAINT_TIMEOUT_MS = 100;

/** Captured at module scope; `document.currentScript` is null once callbacks run. */
const bootstrapScript = document.currentScript as HTMLScriptElement | null;

/**
 * Mirrors `BrowserPopupUtils.inPopup`. Duplicated rather than imported because
 * `browser-popup-utils` pulls in `BrowserApi`.
 */
function inPopup(window: Window) {
  return (
    window.location.href.indexOf("uilocation=") === -1 ||
    window.location.href.indexOf("uilocation=popup") > -1
  );
}

/**
 * Publishes the cached width as a custom property so the popup opens at its final size rather
 * than resizing once the app boots. Set on the document element, not as an inline `body` width,
 * because this runs from `<head>` before `body` exists; index.ejs consumes it.
 * `PopupSizeService` stays the source of truth and re-applies it as an inline style on boot.
 */
function applyCachedWidth(window: Window) {
  if (!inPopup(window)) {
    return;
  }

  const cached = localStorage.getItem(POPUP_WIDTH_STORAGE_KEY);
  const width = PopupWidthOptions[cached as keyof typeof PopupWidthOptions];

  window.document.documentElement.style.setProperty(
    "--bw-boot-width",
    `${width ?? PopupWidthOptions.default}px`,
  );
}

function loadAppBundles() {
  const bundles = bootstrapScript?.dataset.bundles;

  if (!bundles) {
    throw new Error("popup/bootstrap.js is missing its data-bundles attribute.");
  }

  for (const src of bundles.split(",")) {
    const script = document.createElement("script");
    // Dynamically inserted scripts default to async, which does not guarantee execution
    // order. The bundles must run in the order webpack emitted them.
    script.async = false;
    script.src = src;
    document.body.appendChild(script);
  }
}

applyCachedTheme(window);
applyCachedWidth(window);

let loaded = false;
const loadOnce = () => {
  if (loaded) {
    return;
  }
  loaded = true;
  loadAppBundles();
};

const scheduleAppLoad = () => {
  // The first callback runs before the pending frame is rendered, the second after it has been
  // painted -- at which point the loading state is on screen and the main thread is free.
  requestAnimationFrame(() => requestAnimationFrame(loadOnce));
  setTimeout(loadOnce, PAINT_TIMEOUT_MS);
};

// `loadAppBundles` appends to `document.body`, so wait for the parser to reach it.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", scheduleAppLoad, { once: true });
} else {
  scheduleAppLoad();
}
