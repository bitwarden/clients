import { OrganizationUserDetailsResponse } from "@bitwarden/admin-console/common";
import {
  OrganizationUserStatusType,
  OrganizationUserType,
} from "@bitwarden/common/admin-console/enums";
import { PermissionsApi } from "@bitwarden/common/admin-console/models/api/permissions.api";
import { CollectionAccessSelectionView } from "@bitwarden/common/admin-console/models/collections";
import { Guid, OrganizationId, UserId } from "@bitwarden/common/types/guid";

export class OrganizationUserAdminView {
  id: string;
  userId: string;
  organizationId: string;
  type: OrganizationUserType;
  status: OrganizationUserStatusType;
  externalId: string;
  ssoExternalId: string;
  permissions: PermissionsApi;
  resetPasswordEnrolled: boolean = false;
  hasMasterPassword: boolean = false;
  managedByOrganization: boolean = false;

  collections: CollectionAccessSelectionView[] = [];
  groups: string[] = [];

  accessSecretsManager: boolean = false;

  constructor(c: {
    id: Guid;
    userId: UserId;
    organizationId: OrganizationId;
    collections: CollectionAccessSelectionView[];
    type: OrganizationUserType;
    status: OrganizationUserStatusType;
    externalId: string;
    ssoExternalId: string;
    permissions: PermissionsApi;
  }) {
    this.id = c.id;
    this.userId = c.userId;
    this.organizationId = c.organizationId;
    this.type = c.type;
    this.status = c.status;
    this.externalId = c.externalId;
    this.ssoExternalId = c.ssoExternalId;
    this.permissions = c.permissions;
  }

  static fromResponse(
    organizationId: OrganizationId,
    response: OrganizationUserDetailsResponse,
  ): OrganizationUserAdminView {
    const view = new OrganizationUserAdminView({
      ...response,
      id: response.id as Guid,
      userId: response.userId as UserId,
      organizationId: organizationId,
      collections: response.collections.map((c) => ({
        id: c.id,
        hidePasswords: c.hidePasswords,
        readOnly: c.readOnly,
        manage: c.manage,
      })),
    });

    view.groups = response.groups ?? [];
    view.resetPasswordEnrolled = response.resetPasswordEnrolled ?? false;
    view.hasMasterPassword = response.hasMasterPassword ?? false;
    view.managedByOrganization = response.managedByOrganization ?? false;
    view.accessSecretsManager = response.accessSecretsManager ?? false;

    return view;
  }
}
