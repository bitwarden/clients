/**
 * Canonical sender classification.
 *
 * `classifySender` is the only correct interpretation of the §1 sender table in
 * `personal/IMPL-extension-messaging-framework.md`. Never reproduce its logic
 * inline elsewhere — Appendix A's ESLint rule forbids direct reads of
 * `sender.origin` / `sender.tab` / `sender.frameId` outside this file.
 *
 * Pure function. No I/O beyond `chrome.runtime.id` and `chrome.runtime.getURL`,
 * both of which are constant for the lifetime of the extension.
 */

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
 * `chrome-extension://<id>/`; sender.origin reports the same URL without the trailing
 * slash. Trim to match — `new URL("chrome-extension://abc/").origin` would return the
 * literal string `"null"` because chrome-extension is not a WHATWG "special" scheme
 * (see invariant §2.7).
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

/**
 * Firefox MV2 fallback: `MessageSender.origin` was added after `id` in Gecko, so
 * older versions ship without it. When absent, derive from `sender.url`. See
 * invariant §2.8.
 */
function resolvedOrigin(sender: chrome.runtime.MessageSender): string | undefined {
  if (sender.origin) {
    return sender.origin;
  }
  if (sender.url) {
    try {
      return new URL(sender.url).origin;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export function classifySender(sender: chrome.runtime.MessageSender): SenderClass {
  // §1 row 4: anything claiming a foreign extension id is rejected outright. A
  // missing id is also treated as foreign — runtime.onMessage always populates
  // `id` for internal traffic, so its absence is itself suspicious.
  if (sender.id !== chrome.runtime.id) {
    return SenderClass.OtherExtension;
  }

  const origin = resolvedOrigin(sender);
  if (origin === undefined || origin !== extensionOrigin()) {
    // Should be impossible if the runtime kernel is behaving — a sender carrying
    // our own extension id must have our origin. Log-worthy if seen in practice.
    return SenderClass.Untrusted;
  }

  if (sender.tab === undefined) {
    // Chrome documents `frameId` as "only set when tab is set" — popups, options
    // pages and sidepanels arrive with frameId absent rather than 0. Treat both
    // absent and explicit 0 as the top frame; any positive frameId here means a
    // nested foreground iframe.
    return sender.frameId === undefined || sender.frameId === 0
      ? SenderClass.ForegroundPage
      : SenderClass.ForegroundSubframe;
  }

  // For tab-bearing senders the kernel always populates frameId, so the strict
  // `=== 0` check is enough — undefined here would be an anomaly that should fall
  // into the subframe bucket rather than the trusted top-frame bucket.
  return sender.frameId === 0
    ? SenderClass.ContentScriptTopFrame
    : SenderClass.ContentScriptSubframe;
}
