/**
 * Canonical sender classification.
 *
 * `classifySender` is the only correct interpretation of the §1 sender table in
 * `personal/IMPL-extension-messaging-framework.md`. Never reproduce its logic
 * inline elsewhere — Appendix A's ESLint rule forbids direct reads of
 * `sender.origin` / `sender.tab` / `sender.frameId` outside this file.
 *
 * No I/O beyond `chrome.runtime.id` / `chrome.runtime.getURL` (constants for
 * the lifetime of the extension) and a single optional `logSecurityEvent`
 * emit on the COMPAT path. The function is otherwise pure.
 *
 * ## Cross-browser sender shape
 *
 * The set of MessageSender fields the browser kernel actually populates varies:
 *
 * - **Chrome MV3 (all versions):** `id`, `origin`, `url`, `tab`, `frameId` all
 *   populated as documented.
 * - **Firefox 126+:** matches Chrome — `origin` was added in Bug 1787379
 *   (shipped May 2024).
 * - **Firefox 91-125:** `id`, `url`, `tab`, `frameId` populated; `origin` is
 *   **always undefined**.
 *
 * Bitwarden's manifests declare `strict_min_version: "91.0"` for Gecko, so the
 * 91-125 range is contractually supported. This function therefore cannot rely
 * on `sender.origin` being present.
 *
 * ## Why `sender.id` is the primary signal
 *
 * `sender.id` is the extension ID of the sender. It has been kernel-stamped on
 * every WebExtensions implementation since at least Firefox 50 (years before
 * our 91 minimum) and the inception of Chrome MV2. The browser kernel sets it
 * to our own extension's ID for all intra-extension traffic and to a foreign
 * ID for `runtime.onMessageExternal` traffic. It is the one field guaranteed
 * present and unforgeable on every supported version.
 *
 * `sender.url` is **NEVER** consulted as a trust signal. For content-script
 * messages, `sender.url` is the URL of the page where the content script is
 * injected — fully attacker-controlled.
 *
 * ## COMPAT markers
 *
 * Lines tagged `COMPAT(firefox-pre-126)` exist to keep Firefox 91-125 working
 * before Bugzilla 1787379. When `apps/browser/src/manifest{,.v3}.json`'s
 * `strict_min_version` is bumped to `"126.0"` or higher, search this repo for
 * `COMPAT(firefox-pre-126)` and delete every match — those lines become dead
 * code at that moment. The accompanying `logSecurityEvent` reason key
 * `"legacy-firefox-classification"` should be removed at the same time.
 */

import { logSecurityEvent } from "./security-event";

export const SenderClass = Object.freeze({
  ForegroundPage: "foreground-page",
  ForegroundSubframe: "foreground-subframe",
  ContentScriptTopFrame: "content-script-top",
  ContentScriptSubframe: "content-script-subframe",
  OtherExtension: "other-extension",
  Untrusted: "untrusted",
} as const);
export type SenderClass = (typeof SenderClass)[keyof typeof SenderClass];

/**
 * Cached extension origin. `chrome.runtime.getURL("")` returns
 * `chrome-extension://<id>/` (or `moz-extension://<id>/` on Firefox); when
 * `sender.origin` IS present, the kernel reports the same URL without the
 * trailing slash. Trim to match. Plain string comparison — `new URL(...).origin`
 * would return the literal string `"null"` for these non-WHATWG-"special"
 * schemes (see invariant §2.7).
 */
let cachedExtensionOrigin: string | undefined;
function extensionOrigin(): string {
  if (cachedExtensionOrigin === undefined) {
    cachedExtensionOrigin = chrome.runtime.getURL("").replace(/\/$/, "");
  }
  return cachedExtensionOrigin;
}

/**
 * Test-only seam. Resets the cached extension origin so a spec can change the
 * mocked `chrome.runtime.getURL` between cases.
 */
export function __resetExtensionOriginForTests(): void {
  cachedExtensionOrigin = undefined;
}

export function classifySender(sender: chrome.runtime.MessageSender): SenderClass {
  // Step 1 — extension-membership check. `sender.id` is the kernel attestation
  // present on every supported Firefox and Chrome version (see file comment).
  // A missing id is also treated as foreign — onMessage always populates `id`
  // for intra-extension traffic, so its absence is itself suspicious.
  if (sender.id !== chrome.runtime.id) {
    return SenderClass.OtherExtension;
  }

  // Step 2 — defense-in-depth origin check.
  //
  // COMPAT(firefox-pre-126): the `sender.origin !== undefined` guard ONLY runs
  // the strict check when the kernel actually supplied an origin (Chrome MV3,
  // Firefox 126+). On Firefox 91-125 origin is undefined for legitimate
  // messages; we trust sender.id from step 1 and emit a telemetry beacon so
  // we can measure how often the legacy path fires before bumping the floor.
  // We do NOT fall back to `sender.url` — for content-script messages
  // `sender.url` is the page URL, which is attacker-controlled.
  //
  // When `strict_min_version` is bumped to ≥ 126.0, drop the `!== undefined`
  // guard (the check becomes unconditional) and delete the telemetry emit
  // below.
  if (sender.origin !== undefined) {
    if (sender.origin !== extensionOrigin()) {
      // Kernel said our id stamped this message but the origin doesn't match
      // ours — should be impossible if the runtime is sane. Reject defensively.
      return SenderClass.Untrusted;
    }
  } else {
    // COMPAT(firefox-pre-126): we just took the sender.id-only trust path.
    // The classification below is unaffected; the emit is here purely as a
    // measurement hook for the eventual strict_min_version bump.
    logSecurityEvent("legacy-firefox-classification", { tabId: sender.tab?.id });
  }

  // Step 3 — content-vs-foreground discriminator. `sender.tab` is reliable on
  // both Chrome and Firefox: content scripts always have a tab, extension UI
  // pages (popup, options, sidepanel) never do.
  if (sender.tab !== undefined) {
    // For tab-bearing senders the kernel always populates frameId, so the
    // strict `=== 0` check is sufficient — an anomalous undefined here falls
    // into the subframe bucket rather than the trusted top-frame bucket.
    return sender.frameId === 0
      ? SenderClass.ContentScriptTopFrame
      : SenderClass.ContentScriptSubframe;
  }

  // Step 4 — tabless foreground sender. Chrome documents `frameId` as "only
  // set when tab is set" — popups, options pages, sidepanels arrive with
  // frameId absent rather than 0. Treat both absent and explicit 0 as the top
  // frame; any positive frameId here means a nested foreground iframe.
  return sender.frameId === undefined || sender.frameId === 0
    ? SenderClass.ForegroundPage
    : SenderClass.ForegroundSubframe;
}
