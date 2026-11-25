/**
 * Shared data definitions for the fill assist event channel. Lives in its own
 * file with zero imports so the content-script bundle can reach these
 * constants without pulling the receiver's background-only dependencies
 * (`LogService`, `isExternalMessage`) into content-script code.
 */

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
