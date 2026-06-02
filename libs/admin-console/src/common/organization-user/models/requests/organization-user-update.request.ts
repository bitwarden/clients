import { OrganizationUserType } from "@bitwarden/common/admin-console/enums";
import { PermissionsApi } from "@bitwarden/common/admin-console/models/api/permissions.api";
import { SelectionReadOnlyRequest } from "@bitwarden/common/admin-console/models/request/selection-read-only.request";

export class OrganizationUserUpdateRequest {
  type: OrganizationUserType;
  accessSecretsManager: boolean;
  collections: SelectionReadOnlyRequest[];
  groups: string[] | undefined;
  permissions: PermissionsApi;

  constructor(c: {
    type: OrganizationUserType;
    permissions: PermissionsApi;
    accessSecretsManager?: boolean;
    collections?: SelectionReadOnlyRequest[];
    groups?: string[];
  }) {
    this.type = c.type;
    this.accessSecretsManager = c.accessSecretsManager ?? false;
    this.collections = c.collections ?? [];
    this.groups = c.groups;
    this.permissions = c.permissions;
  }
}
