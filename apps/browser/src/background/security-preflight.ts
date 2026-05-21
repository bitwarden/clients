/**
 * Background message-handler security preflight.
 *
 * Runs at the very top of `chrome.runtime.onMessage` dispatch. Phase 2 cutover
 * per `personal/IMPL-extension-messaging-framework.md` §6.1.
 *
 * **Strict for env-paired traffic, soft for legacy.** Messages carrying an
 * `_envPair` claim go through the full four-step pipeline (classify → allowlist
 * → schema → per-class checks). Messages without `_envPair` are legacy and are
 * still subject to step 1 (classify-reject Other/Untrusted) but bypass the
 * allowlist/schema/per-class layers until they're migrated. This is what
 * makes the cutover incremental — the framework defends new channels
 * immediately while older ones inherit only the threat-model row 4 protection.
 *
 * @returns true → continue to legacy dispatch; false → drop the message
 */

import { logSecurityEvent } from "../autofill/security/security-event";
import { classifySender, SenderClass } from "../autofill/security/sender";
// The env-paired middleware lives in platform/messaging, which is normally
// off-limits to cross-team consumers. This is a deliberate exception: the
// background preflight is the canonical caller of `passesEnvPair`.
// eslint-disable-next-line no-restricted-imports
import { passesEnvPair, type EnvPair } from "../platform/messaging/env-pair";

type InboundMessage = { command?: string; _envPair?: EnvPair } & Record<string, unknown>;

/**
 * Step 1 of §6.1: classify and reject sender classes that have no legitimate
 * channel into the background regardless of `_envPair`.
 */
function senderClassIsForbidden(senderClass: SenderClass): boolean {
  return (
    senderClass === SenderClass.OtherExtension ||
    senderClass === SenderClass.Untrusted ||
    senderClass === SenderClass.ForegroundSubframe
  );
}

export function runSecurityPreflight(
  msg: InboundMessage,
  sender: chrome.runtime.MessageSender,
): boolean {
  // Step 1 — sender classification. Unconditional; applies to both env-paired
  // and legacy messages. The §1 threat-model row 4 senders have no legitimate
  // way to reach our background.
  const senderClass = classifySender(sender);
  if (senderClassIsForbidden(senderClass)) {
    logSecurityEvent("sender-class-rejected", {
      senderClass,
      command: msg?.command,
      tabId: sender.tab?.id,
    });
    return false;
  }

  // Legacy bypass — messages that haven't migrated still flow through the
  // existing switch dispatch. As channels migrate they pick up `_envPair` and
  // graduate into the strict path below.
  if (!msg?._envPair) {
    return true;
  }

  // Steps 2-4 collapsed via passesEnvPair: predicate chain registered for the
  // claimed pair. Schema validation lives on the individual handle (run by
  // onMessageFor / onMessages), not here.
  if (!passesEnvPair(msg, sender)) {
    logSecurityEvent("command-not-allowlisted", {
      command: msg.command,
      senderClass,
      tabId: sender.tab?.id,
    });
    return false;
  }

  return true;
}
