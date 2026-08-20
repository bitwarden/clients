import { AccessDecisionVerdict } from "../../abstractions/access-decision-verdict";

export class AccessDecisionRequest {
  verdict: AccessDecisionVerdict;
  comment?: string;

  constructor(init: { verdict: AccessDecisionVerdict; comment?: string }) {
    this.verdict = init.verdict;
    this.comment = init.comment;
  }
}
