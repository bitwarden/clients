import { styleShell } from "@bitwarden/browser/platform/popup/shell/popup-shell";

import "@bitwarden/browser/popup/scss";

/**
 * Chrome shows an action popup only when its document reaches `load`, and runs the renderer at
 * background priority until then. Everything imported here is parsed before the popup appears, so
 * this entry only styles the static shell and loads the app afterwards. Keep it that way: the
 * ESLint override for pre-load files restricts what this file and the shell module may import.
 */
styleShell();

window.addEventListener(
  "load",
  () => void import(/* webpackChunkName: "popup/app" */ "./bootstrap"),
  {
    once: true,
  },
);
