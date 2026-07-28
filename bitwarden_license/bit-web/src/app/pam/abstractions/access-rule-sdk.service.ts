import { OrganizationId } from "@bitwarden/common/types/guid";

import type { AccessRuleAddEditRequest, AccessRuleView } from "./access-rule";

/**
 * Access-rule CRUD is served by the Rust SDK
 * (`client.commercial().pam().access_rules()`). Errors surface as the SDK's
 * flat `AccessRuleError` shape (see `./access-rule`) rather than
 * `ErrorResponse`.
 */
export abstract class AccessRuleSdkService {
  abstract listAccessRules(organizationId: OrganizationId): Promise<AccessRuleView[]>;
  abstract getAccessRule(organizationId: OrganizationId, id: string): Promise<AccessRuleView>;
  abstract createAccessRule(
    organizationId: OrganizationId,
    request: AccessRuleAddEditRequest,
  ): Promise<AccessRuleView>;
  abstract updateAccessRule(
    organizationId: OrganizationId,
    id: string,
    request: AccessRuleAddEditRequest,
  ): Promise<AccessRuleView>;
  abstract deleteAccessRule(organizationId: OrganizationId, id: string): Promise<void>;
}
