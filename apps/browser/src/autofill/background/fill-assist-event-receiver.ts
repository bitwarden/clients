import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

export const FillAssistEventName = Object.freeze({
  QualificationFailed: "fill_assist_rule_qualification_failed",
} as const);
export type FillAssistEventName = (typeof FillAssistEventName)[keyof typeof FillAssistEventName];

export const FillAssistMissReason = Object.freeze({
  Structural: "structural",
  InScopeExtras: "in_scope_extras",
} as const);
export type FillAssistMissReason = (typeof FillAssistMissReason)[keyof typeof FillAssistMissReason];

export type FillAssistEvent = {
  name: typeof FillAssistEventName.QualificationFailed;
  payload: {
    domain: string;
    missReason: FillAssistMissReason;
    ruleId: string;
  };
};

export interface FillAssistEventReceiver {
  receive(event: FillAssistEvent): void;
}

/**
 * TODO: Update or remove this temporary note during fill assist M6. This class is
 * an M3.5 placeholder. Logs the event locally to observe emissions during
 * development. M6 will wire in the real consumer. The emitter, the message shape,
 * and this interface stay stable across the swap.
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
