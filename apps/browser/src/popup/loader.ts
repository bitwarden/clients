import {
  POPUP_WIDTH_STORAGE_KEY,
  THEME_STATE_KEY,
  ShellTheme,
  isPopupLocation,
  resolveShellTheme,
  shellWidthPx,
  themeClass,
  unwrapStored,
} from "./popup-shell";

/**
 * Styles the static shell and loads the popup's bundles once the document has finished loading.
 *
 * Chrome shows an action popup only when its document reaches the `load` event
 * (`ExtensionPopup::DocumentOnLoadCompletedInPrimaryMainFrame`) and runs the renderer at
 * background priority until then. With the bundles referenced from the HTML, `load` waits for
 * all of them to parse and evaluate, so the user sees nothing for as long as a backgrounded
 * renderer takes to get through them. Injecting them after `load` lets the popup appear at once
 * with the static spinner, and the bundles then parse in a renderer Chrome treats as visible.
 *
 * Because the shell is now what the user sees first, it takes the stored width and theme. Chrome
 * sizes the popup once, at `load`, so the width is set synchronously from the `localStorage` copy
 * `PopupSizeService` keeps, with the default when there is none. The OS color scheme is applied
 * at once, then corrected from the theme state in `chrome.storage.local`.
 *
 * `index.ejs` renders the bundle paths into this script's `data-chunks` attribute, space separated.
 * They are data on the tag rather than an inline script because the extension CSP forbids inline
 * scripts.
 */
const sources: string[] =
  document.querySelector<HTMLScriptElement>("script[data-chunks]")?.dataset.chunks?.split(" ") ??
  [];

const prefersDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;

function setTheme(theme: ShellTheme) {
  document.documentElement.classList.remove(themeClass("light"), themeClass("dark"));
  document.documentElement.classList.add(themeClass(theme));
}

/** Whether this document is the action popup, as opposed to the same page opened in a tab. */
function isActionPopup(): boolean {
  if (globalThis.chrome?.extension?.getViews == null) {
    return isPopupLocation(window.location.href);
  }

  return chrome.extension.getViews({ type: "popup" }).includes(window);
}

function styleShell() {
  // A tab has no fixed width; `PopupSizeService` makes the same distinction.
  if (isActionPopup()) {
    document.body.style.width = `${shellWidthPx(localStorage.getItem(POPUP_WIDTH_STORAGE_KEY))}px`;
  }

  setTheme(resolveShellTheme(null, prefersDark()));
  globalThis.chrome?.storage?.local?.get(THEME_STATE_KEY, (stored) => {
    setTheme(resolveShellTheme(unwrapStored(stored?.[THEME_STATE_KEY]), prefersDark()));
  });
}

function loadChunks() {
  for (const src of sources) {
    const script = document.createElement("script");
    script.src = src;
    // Scripts inserted from script run as soon as they arrive; keep the bundles in order.
    script.async = false;
    document.head.appendChild(script);
  }
}

try {
  styleShell();
} catch {
  // The shell styling is cosmetic; the app applies both itself once it runs.
}

if (document.readyState === "complete") {
  loadChunks();
} else {
  window.addEventListener("load", loadChunks, { once: true });
}
