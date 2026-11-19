import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { isExternalMessage } from "@bitwarden/common/platform/messaging";

import { FillAssistEvent, FillAssistEventName, FillAssistMissReason } from "./fill-assist-event";

/**
 * Type guard for `FillAssistEvent`. Combines the external-tag check with a
 * full shape check so the narrowed type implies both that the message arrived
 * through the chrome.runtime ingest boundary and that its members match the
 * receiver's contract.
 */
export function isFillAssistEvent(msg: unknown): msg is FillAssistEvent {
  if (!isExternalMessage(msg)) {
    return false;
  }
  if (msg.name !== FillAssistEventName.QualificationFailed) {
    return false;
  }
  const payload = msg.payload;
  if (typeof payload !== "object" || payload === null) {
    return false;
  }
  const p = payload as Record<PropertyKey, unknown>;
  return (
    typeof p.domain === "string" &&
    typeof p.ruleId === "string" &&
    (p.missReason === FillAssistMissReason.Structural ||
      p.missReason === FillAssistMissReason.InScopeExtras)
  );
}

export interface FillAssistEventReceiver {
  receive(event: FillAssistEvent): void;
}

/**
 * No-op receiver. Logs the event locally so emissions are observable during
 * development.
 *
 * FIXME (PM-34713): replace with the real consumer during fill assist M6.
 */
export class NoopFillAssistEventReceiver implements FillAssistEventReceiver {
  constructor(private logService: LogService) {}

  receive(event: FillAssistEvent): void {
    try {
      this.logService.debug("[FillAssistEventReceiver:Noop]", event);
    } catch {
      // Do not propagate. An unhandled throw here would reach the background
      // message pipeline as a rejection.
    }
  }
}
