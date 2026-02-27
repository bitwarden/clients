// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { OrganizationUserType } from "@bitwarden/common/admin-console/enums";
import { PermissionsApi } from "@bitwarden/common/admin-console/models/api/permissions.api";
import { SelectionReadOnlyRequest } from "@bitwarden/common/admin-console/models/request/selection-read-only.request";

export class OrganizationUserUpdateRequest {
  type: OrganizationUserType;
  accessSecretsManager: boolean;
  collections: SelectionReadOnlyRequest[] = [];
  groups: string[] = [];
  permissions: PermissionsApi;
}
