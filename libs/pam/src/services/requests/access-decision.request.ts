export const AccessDecisionVerdict = Object.freeze({
  Approve: "approve",
  Deny: "deny",
} as const);
export type AccessDecisionVerdict =
  (typeof AccessDecisionVerdict)[keyof typeof AccessDecisionVerdict];

export class AccessDecisionRequest {
  verdict: AccessDecisionVerdict;
  comment?: string;

  constructor(init: { verdict: AccessDecisionVerdict; comment?: string }) {
    this.verdict = init.verdict;
    this.comment = init.comment;
  }
}
