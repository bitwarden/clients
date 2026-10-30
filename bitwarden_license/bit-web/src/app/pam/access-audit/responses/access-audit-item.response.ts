import { BaseResponse } from "@bitwarden/common/models/response/base.response";

/**
 * One subject the trail names within a range, for the Item filter. Exactly one of the two pairs is
 * set. A cipher carries no name, since that is vault data the client resolves from its own vault.
 */
export class AccessAuditItemResponse extends BaseResponse {
  cipherId: string | null;
  /** The collection the cipher was most recently gated through, to qualify a shared name. */
  collectionId: string | null;
  ruleId: string | null;
  /** As the most recent event in range recorded it. */
  ruleName: string | null;

  constructor(response: unknown) {
    super(response);
    this.cipherId = this.getResponseProperty("CipherId") ?? null;
    this.collectionId = this.getResponseProperty("CollectionId") ?? null;
    this.ruleId = this.getResponseProperty("RuleId") ?? null;
    this.ruleName = this.getResponseProperty("RuleName") ?? null;
  }
}
