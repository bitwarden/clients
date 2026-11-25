import type { FillAssistMissReason } from "../../background/fill-assist-event";

/**
 * Typed wrapper over `sendExtensionMessage("fillAssistEmit", event)` for the
 * content script. Lets `RuleQualificationService` dispatch fill assist events
 * without calling `sendExtensionMessage` directly or knowing the event payload
 * shape. Named methods encapsulate the event shape so callers name what
 * happened, not how the payload is built.
 */
export interface FillAssistEventEmitter {
  qualificationFailed(domain: string, missReason: FillAssistMissReason): void;
}
