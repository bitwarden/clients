// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import {
  CollectionAccessSelectionView,
  OrganizationUserDetailsResponse,
} from "@bitwarden/admin-console/common";
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

  static fromResponse(
    organizationId: string,
    response: OrganizationUserDetailsResponse,
  ): OrganizationUserAdminView {
    const view = new OrganizationUserAdminView();

    view.id = response.id;
    view.organizationId = organizationId;
    view.userId = response.userId;
    view.type = response.type;
    view.status = response.status;
    view.externalId = response.externalId;
    view.permissions = response.permissions;
    view.resetPasswordEnrolled = response.resetPasswordEnrolled;
    view.collections = response.collections.map((c) => ({
      id: c.id,
      hidePasswords: c.hidePasswords,
      readOnly: c.readOnly,
      manage: c.manage,
    }));
    view.groups = response.groups;
    view.accessSecretsManager = response.accessSecretsManager;
    view.hasMasterPassword = response.hasMasterPassword;
    view.managedByOrganization = response.managedByOrganization;

    return view;
  }
}
