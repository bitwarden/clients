import { CollectionAccessSelectionView } from "@bitwarden/admin-console/common";
import {
  OrganizationUserStatusType,
  OrganizationUserType,
} from "@bitwarden/common/admin-console/enums";
import { PermissionsApi } from "@bitwarden/common/admin-console/models/api/permissions.api";

export class OrganizationUserAdminView {
  id: string;
  userId: string;
  organizationId: string;
  type: OrganizationUserType;
  status: OrganizationUserStatusType;
  externalId: string;
  permissions: PermissionsApi;
  resetPasswordEnrolled: boolean;
  hasMasterPassword: boolean;
  managedByOrganization: boolean;

  collections: CollectionAccessSelectionView[] = [];
  groups: string[] = [];

  accessSecretsManager: boolean;
}
