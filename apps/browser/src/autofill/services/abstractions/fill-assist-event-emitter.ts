import type { FillAssistEvent } from "../../background/fill-assist-event-receiver";

/**
 * Typed wrapper over `sendExtensionMessage("fillAssistEmit", event)` for the
 * content script. Lets `RuleQualificationService` dispatch a
 * `fill_assist_rule_qualification_failed` event without pulling the raw
 * message plumbing into the qualification path.
 *
 * The message shape and the `FillAssistEvent` contract are defined by the
 * receiver in `background/fill-assist-event-receiver.ts`. The receiver
 * implementation may change; this interface and its dispatch call stay stable.
 */
export interface FillAssistEventEmitter {
  emit(event: FillAssistEvent): void;
}
