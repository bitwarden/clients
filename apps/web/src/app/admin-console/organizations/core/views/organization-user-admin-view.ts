import { OrganizationUserDetailsResponse } from "@bitwarden/admin-console/common";
import {
  OrganizationUserStatusType,
  OrganizationUserType,
} from "@bitwarden/common/admin-console/enums";
import { PermissionsApi } from "@bitwarden/common/admin-console/models/api/permissions.api";
import { CollectionAccessSelectionView } from "@bitwarden/common/admin-console/models/collections";
import { Guid, OrganizationId, UserId } from "@bitwarden/common/types/guid";

export class OrganizationUserAdminView {
  id: Guid;
  userId: UserId;
  organizationId: OrganizationId;
  type: OrganizationUserType;
  status: OrganizationUserStatusType;
  externalId: string;
  ssoExternalId: string;
  permissions: PermissionsApi;
  resetPasswordEnrolled: boolean;
  hasMasterPassword: boolean;
  managedByOrganization: boolean;

  collections: CollectionAccessSelectionView[] = [];
  groups: string[] = [];

  accessSecretsManager: boolean;

  constructor(c: {
    id: Guid;
    userId: UserId;
    organizationId: OrganizationId;
    collections: CollectionAccessSelectionView[];
    groups: string[];
    type: OrganizationUserType;
    status: OrganizationUserStatusType;
    externalId: string;
    ssoExternalId: string;
    permissions: PermissionsApi;
    accessSecretsManager: boolean;
    resetPasswordEnrolled: boolean;
    hasMasterPassword: boolean;
    managedByOrganization: boolean;
  }) {
    this.id = c.id;
    this.userId = c.userId;
    this.organizationId = c.organizationId;
    this.collections = c.collections;
    this.groups = c.groups;
    this.type = c.type;
    this.status = c.status;
    this.externalId = c.externalId;
    this.ssoExternalId = c.ssoExternalId;
    this.permissions = c.permissions;
    this.accessSecretsManager = c.accessSecretsManager;
    this.resetPasswordEnrolled = c.resetPasswordEnrolled;
    this.hasMasterPassword = c.hasMasterPassword;
    this.managedByOrganization = c.managedByOrganization;
  }

  static fromResponse(
    organizationId: OrganizationId,
    response: OrganizationUserDetailsResponse,
  ): OrganizationUserAdminView {
    const view = new OrganizationUserAdminView({
      id: response.id as Guid,
      userId: response.userId as UserId,
      organizationId: organizationId,
      collections: response.collections.map((c) => ({
        id: c.id,
        hidePasswords: c.hidePasswords,
        readOnly: c.readOnly,
        manage: c.manage,
      })),
      groups: response.groups ?? [],
      type: response.type,
      status: response.status,
      externalId: response.externalId,
      ssoExternalId: response.ssoExternalId,
      permissions: response.permissions,
      accessSecretsManager: response.accessSecretsManager ?? false,
      resetPasswordEnrolled: response.resetPasswordEnrolled ?? false,
      hasMasterPassword: response.hasMasterPassword ?? false,
      managedByOrganization: response.managedByOrganization ?? false,
    });

    return view;
  }
}
