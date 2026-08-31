import { BaseResponse } from "@bitwarden/common/models/response/base.response";

/**
 * One subject the access-audit trail names within a range, as the Item filter offers it. Exactly one of
 * the two pairs is set, and which one is how a credential is told from an access rule.
 *
 * No cipher name is here, deliberately: a cipher's name is Vault Data this client decrypts from its own
 * vault, and an auditor generally cannot decrypt another member's items. A rule's name is plaintext
 * organization configuration, so it travels with the id.
 */
export class AccessAuditItemResponse extends BaseResponse {
  /** The subject cipher. Null on a rule item. */
  cipherId: string | null;
  /** The collection the cipher was most recently gated through — the qualifier for a shared name. */
  collectionId: string | null;
  /** The subject access rule. Null on a cipher item. */
  ruleId: string | null;
  /** The rule's name as the most recent event in range recorded it. Null on a cipher item. */
  ruleName: string | null;

  constructor(response: unknown) {
    super(response);
    this.cipherId = this.getResponseProperty("CipherId") ?? null;
    this.collectionId = this.getResponseProperty("CollectionId") ?? null;
    this.ruleId = this.getResponseProperty("RuleId") ?? null;
    this.ruleName = this.getResponseProperty("RuleName") ?? null;
  }
}
