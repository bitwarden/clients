import { POPUP_WIDTH_STORAGE_KEY, PopupWidthOptions } from "../platform/browser/popup-width";
import { applyCachedTheme } from "../platform/popup/theme/popup-theme-cache";

/**
 * Pre-bootstrap script for the popup.
 *
 * The popup's app bundles are ~7MB of JavaScript. Compiling and evaluating them occupies the
 * main thread continuously, and because Chrome does not display the popup window until the
 * renderer produces a frame, clicking the toolbar icon leaves the user looking at nothing for
 * the whole time. Measured on a fast Mac with a locked vault, that was ~950ms of dead click.
 *
 * So this script runs first, paints the loading state, and only then loads the app bundles.
 * Total time to an interactive popup is unchanged (one or two frames worse, in fact) — but the
 * window now appears almost immediately, so the click is acknowledged instead of ignored.
 *
 * Two constraints worth knowing before changing this file:
 *
 * 1. It must stay dependency-free. Anything imported here lands on the critical path ahead of
 *    the first frame, which is the exact problem being solved.
 * 2. It is loaded as a parser-blocking script in `<head>`, so it must not touch `document.body`
 *    at top level -- the parser has not reached it yet. Being parser-blocking is the point:
 *    with no other blocking scripts left, Chrome will happily paint the loading state before a
 *    `defer` script gets to run, and the theme would be applied a frame too late.
 */

/**
 * Ceiling on how long to wait for the loading state to paint before giving up and loading the
 * app anyway. `requestAnimationFrame` does not fire while the document is render-blocked (a
 * stylesheet still in flight, say), and never showing the app is far worse than never showing
 * the spinner.
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
 * Publishes the cached popup width as a custom property so the loading state is the same size
 * as the app that replaces it, instead of the window resizing once the app boots.
 *
 * Set on the document element rather than as an inline `body` width because this runs from
 * `<head>`, before `body` exists. index.ejs consumes it, defaulting to the full width used by
 * the popout and tab layouts. `PopupSizeService` remains the source of truth and re-applies the
 * width as an inline style once the app has booted.
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
