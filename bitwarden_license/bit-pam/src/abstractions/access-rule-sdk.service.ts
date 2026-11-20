import { OrganizationId } from "@bitwarden/common/types/guid";

import type { AccessRuleAddEditRequest, AccessRuleId, AccessRuleView } from "./access-rule";

/** Errors surface as the SDK's flat `AccessRuleError`, not `ErrorResponse`. */
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
}
