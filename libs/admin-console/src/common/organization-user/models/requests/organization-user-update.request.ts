import { OrganizationUserType } from "@bitwarden/common/admin-console/enums";
import { PermissionsApi } from "@bitwarden/common/admin-console/models/api/permissions.api";
import { SelectionReadOnlyRequest } from "@bitwarden/common/admin-console/models/request/selection-read-only.request";
// eslint-disable-next-line no-restricted-imports
import { EncryptedString } from "@bitwarden/legacy-crypto";

export class OrganizationUserUpdateRequest {
  type: OrganizationUserType;
  accessSecretsManager: boolean;
  accessPam: boolean;
  collections: SelectionReadOnlyRequest[];
  groups: string[] | undefined;
  permissions: PermissionsApi;
  defaultUserCollectionName: EncryptedString | undefined;
  email: string | undefined;
  name: string | undefined;

  constructor(c: {
    type: OrganizationUserType;
    permissions: PermissionsApi;
    accessSecretsManager?: boolean;
    accessPam?: boolean;
    collections?: SelectionReadOnlyRequest[];
    groups?: string[];
    defaultUserCollectionName?: EncryptedString;
    email?: string;
    name?: string;
  }) {
    this.type = c.type;
    this.accessSecretsManager = c.accessSecretsManager ?? false;
    this.accessPam = c.accessPam ?? false;
    this.collections = c.collections ?? [];
    this.groups = c.groups;
    this.permissions = c.permissions;
    this.defaultUserCollectionName = c.defaultUserCollectionName;
    this.email = c.email;
    this.name = c.name;
  }
}
