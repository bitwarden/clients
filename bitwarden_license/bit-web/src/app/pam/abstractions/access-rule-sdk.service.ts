import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";

import type { AccessRuleAddEditRequest, AccessRuleId, AccessRuleView } from "./access-rule";

/**
 * Access-rule CRUD is served by the Rust SDK
 * (`client.commercial().pam().access_rules()`). Errors surface as the SDK's
 * flat `AccessRuleError` shape (see `./access-rule`) rather than
 * `ErrorResponse`.
 */
export abstract class AccessRuleSdkService {
  abstract listAccessRules(organizationId: OrganizationId): Promise<AccessRuleView[]>;
  abstract getAccessRule(organizationId: OrganizationId, id: AccessRuleId): Promise<AccessRuleView>;
  abstract createAccessRule(
    organizationId: OrganizationId,
    request: AccessRuleAddEditRequest,
  ): Promise<AccessRuleView>;
  abstract updateAccessRule(
    organizationId: OrganizationId,
    id: AccessRuleId,
    request: AccessRuleAddEditRequest,
  ): Promise<AccessRuleView>;
  abstract deleteAccessRule(organizationId: OrganizationId, id: AccessRuleId): Promise<void>;

  /**
   * Where `id` fails to gate: the collections letting the ciphers it governs through without a
   * lease.
   *
   * Gating is a union — a cipher is withheld only when EVERY collection reaching it is governed
   * by an enabled rule — so these are the ordinary collections exposing an otherwise-protected
   * credential, de-duplicated across the ciphers they expose.
   *
   * An empty array means the rule protects everything (or is disabled); a non-empty array is
   * itself the warning, with no separate flag to keep in step.
   *
   * Affected ciphers are deliberately not reported: naming one means decrypting it from the
   * caller's own vault, which the admin being warned lacks. Collections are reliably nameable
   * and what remediation acts on.
   */
  abstract listBypassGaps(
    organizationId: OrganizationId,
    id: AccessRuleId,
  ): Promise<CollectionId[]>;
}
