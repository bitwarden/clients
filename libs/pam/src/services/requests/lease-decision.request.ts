export type LeaseDecision = "approve" | "deny";

export class LeaseDecisionRequest {
  decision: LeaseDecision;
  comment?: string;

  constructor(init: { decision: LeaseDecision; comment?: string }) {
    this.decision = init.decision;
    this.comment = init.comment;
  }
}
