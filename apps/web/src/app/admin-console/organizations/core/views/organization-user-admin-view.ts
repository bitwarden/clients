import { OrganizationUserStatusType , OrganizationUserType } from "@bitwarden/common/admin-console/enums";
import { PermissionsApi } from "@bitwarden/common/admin-console/models/api/permissions.api";

import { CollectionAccessSelectionView } from "./collection-access-selection.view";

export class OrganizationUserAdminView {
  id: string;
  userId: string;
  organizationId: string;
  type: OrganizationUserType;
  status: OrganizationUserStatusType;
  externalId: string;
  accessAll: boolean;
  permissions: PermissionsApi;
  resetPasswordEnrolled: boolean;

  collections: CollectionAccessSelectionView[] = [];
  groups: string[] = [];

  accessSecretsManager: boolean;
}
