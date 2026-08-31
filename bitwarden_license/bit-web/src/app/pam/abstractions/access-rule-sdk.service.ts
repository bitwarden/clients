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
   * Gating is a union — a cipher is withheld only when EVERY collection it can be reached through is
   * governed by an enabled rule — so a credential also sitting in an ordinary collection is not
   * protected at all. These are those ordinary collections, de-duplicated across the ciphers they
   * expose.
   *
   * An empty array is the normal answer and means the rule protects everything it governs; a rule
   * that is switched off answers empty too, since it gates nothing. A NON-EMPTY array is itself the
   * warning condition, so there is no separate flag to keep in step.
   *
   * The affected ciphers are deliberately not reported. Naming one means decrypting it from the
   * caller's own vault, and an admin outside the collection — precisely the admin being warned — has
   * none of its ciphers there, so the names would be blank for the person who needs them. The
   * collections are both reliably nameable (the admin collection read returns every one of them)
   * and what remediation actually acts on.
   */
  abstract listBypassGaps(
    organizationId: OrganizationId,
    id: AccessRuleId,
  ): Promise<CollectionId[]>;
}
