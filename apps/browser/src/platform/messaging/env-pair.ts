/**
 * Content-safe env-pair middleware: predicate table and helpers that gate inbound
 * `chrome.runtime` / `chrome.tabs` messages by the `<sender>:<receiver>` pair
 * declared on the wire.
 *
 * **Content-safe.** This module imports neither `BrowserApi` nor any Angular
 * code — it relies only on `chrome.runtime.getURL`, which content scripts may
 * call directly (see `apps/browser/.claude/rules/autofill-content-scripts.md`).
 *
 * **Claim vs. proof (§2.1).** `_envPair` on the wire is a claim by the sender;
 * `passesEnvPair` only treats it as a selector for which predicate chain to run.
 * Each predicate checks browser-kernel-stamped fields on the `MessageSender`.
 */

import { getWebExtSender } from "@bitwarden/messaging";

import { classifySender, SenderClass } from "../../autofill/security/sender";

/**
 * Extension-script execution environments that can participate in a message exchange.
 *
 * - `page`        — untrusted host page (DOM `window.postMessage` boundary)
 * - `content`     — content script main world
 * - `isolated`    — content script isolated world
 * - `popup`       — extension popup / options / sidepanel UI
 * - `background`  — service worker (MV3) / background page (MV2)
 */
export type Env = "page" | "content" | "isolated" | "popup" | "background";

/**
 * Declared `<sender>:<receiver>` pair for a `sendMessage` call.
 *
 * The pair is a **claim** by the sender about its provenance and intended
 * audience. It selects the predicate chain that runs on the receiver, and each
 * chain is responsible for verifying the provenance that its claim implies.
 */
export type EnvPair = `${Env}:${Env}`;

/** Brand symbol stamped on handles created via `defineNotice` / `defineRequest`. */
export const ENV_PAIR_TAG = Symbol("envPair");

/**
 * A receiver-side check applied to an incoming message. Returns `true` if the
 * message may continue to the handler; `false` to reject it.
 */
export type EnvPairCheck = (
  message: { _envPair?: EnvPair } & Record<string, unknown>,
  sender: chrome.runtime.MessageSender,
) => boolean;

/**
 * Cached extension origin. Lazy-init so the module imports cheaply in tests.
 *
 * Uses string manipulation rather than `new URL().origin` because
 * `chrome-extension:` is not a "special" URL scheme by WHATWG rules — see
 * invariant §2.7.
 */
let cachedExtensionOrigin: string | undefined;
function extensionOrigin(): string {
  if (cachedExtensionOrigin === undefined) {
    cachedExtensionOrigin = chrome.runtime.getURL("").replace(/\/$/, "");
  }
  return cachedExtensionOrigin;
}

/** Test seam — let specs change the mocked origin between cases. */
export function __resetExtensionOriginForTests(): void {
  cachedExtensionOrigin = undefined;
}

/**
 * The message claims to come from an extension-owned context.
 *
 * `frameId` is absent for popups/options pages, so the check is "present implies
 * zero" rather than "must equal zero" — see invariant §2.3 reasoning in
 * `sender.ts` for the analogous classifier branch.
 */
export const requireInternalSender: EnvPairCheck = (_msg, sender) => {
  if (!sender?.origin) {
    return false;
  }
  if (sender.origin !== extensionOrigin()) {
    return false;
  }
  if ("frameId" in sender && sender.frameId !== 0 && sender.frameId !== undefined) {
    return false;
  }
  return true;
};

/** The sender must be associated with a tab — only content scripts have one. */
export const requireSenderTab: EnvPairCheck = (_msg, sender) => sender?.tab != null;

/** The sender must report a numeric frameId — only content scripts provide one. */
export const requireFrameId: EnvPairCheck = (_msg, sender) => typeof sender?.frameId === "number";

/**
 * Distinguishes content scripts from extension pages (popup, options,
 * sidepanel). Both share `sender.origin === extensionOrigin`, so origin alone
 * cannot tell them apart — content scripts have `sender.tab`, extension pages
 * don't.
 *
 * Phase 3 §7.1: closes an existing soft-check gap. Without it, a popup-shaped
 * sender can pass a `content:background` chain and vice versa. Added to every
 * existing pair in the same change per §7.1.
 */
export const distinguishContentVsExtensionPage =
  (expect: "tab-present" | "tab-absent"): EnvPairCheck =>
  (_msg, sender) => {
    const hasTab = sender?.tab != null;
    return expect === "tab-present" ? hasTab : !hasTab;
  };

/**
 * Predicate chain by EnvPair claim. Look-ups returning `undefined` are treated
 * as rejection by `passesEnvPair` — there is no silent pass path (§2.4).
 *
 * Add a row here when a new channel ships. Keep the chain minimal: every
 * predicate must be verifiable browser-kernel state.
 */
export const middlewareByEnvPair: Partial<Record<EnvPair, EnvPairCheck[]>> = {
  // Popup, options page, sidepanel UI talking to the background SW.
  "popup:background": [requireInternalSender, distinguishContentVsExtensionPage("tab-absent")],
  // Background SW talking back to a popup-shaped recipient — same shape on receive.
  "background:popup": [requireInternalSender, distinguishContentVsExtensionPage("tab-absent")],
  // Content script in a tab talking to the background SW.
  "content:background": [
    requireInternalSender,
    requireSenderTab,
    requireFrameId,
    distinguishContentVsExtensionPage("tab-present"),
  ],
  // Background SW pushing to a content script — receiver-side, the sender shape
  // mirrors the popup-shaped one (no tab on the sender from the background's view).
  "background:content": [requireInternalSender, distinguishContentVsExtensionPage("tab-absent")],
};

/**
 * Run the predicate chain declared for `message._envPair`. Returns `true` only
 * when (a) the message declares a pair, (b) a chain is registered for it, and
 * (c) every predicate in the chain returns `true`.
 *
 * Content-safe entry point — content scripts may call this directly.
 */
export function passesEnvPair(
  message: { _envPair?: EnvPair } & Record<string, unknown>,
  sender: chrome.runtime.MessageSender,
): boolean {
  const pair = message?._envPair;
  if (!pair) {
    return false;
  }
  const chain = middlewareByEnvPair[pair];
  if (!chain) {
    return false;
  }
  // First defense: classify the sender. Other-extension and Untrusted classes
  // are unconditionally rejected here (§1 threat model row 4) before any
  // predicate runs — predicates assume an already-trusted-class sender.
  const senderClass = classifySender(sender);
  if (
    senderClass === SenderClass.OtherExtension ||
    senderClass === SenderClass.Untrusted ||
    senderClass === SenderClass.ForegroundSubframe
  ) {
    return false;
  }
  for (const predicate of chain) {
    if (!predicate(message, sender)) {
      return false;
    }
  }
  return true;
}

/**
 * Helper for receivers that read the sender via the Symbol-stamped attachment
 * rather than via the runtime callback. Looks up `WEB_EXT_SENDER` on the
 * message and runs `passesEnvPair` against the result. Returns `false` when the
 * message did not arrive via the chrome-runtime adapter (no Symbol stamp).
 */
export function runEnvPairListener(
  message: { _envPair?: EnvPair } & Record<string, unknown>,
): boolean {
  const sender = getWebExtSender(message) as chrome.runtime.MessageSender | undefined;
  if (!sender) {
    return false;
  }
  return passesEnvPair(message, sender);
}
