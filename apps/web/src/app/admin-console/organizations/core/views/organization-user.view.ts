import { OrganizationUserUserDetailsResponse } from "@bitwarden/admin-console/common";
import {
  OrganizationUserStatusType,
  OrganizationUserType,
  RevocationReasonType,
} from "@bitwarden/common/admin-console/enums";
import { PermissionsApi } from "@bitwarden/common/admin-console/models/api/permissions.api";
import { CollectionAccessSelectionView } from "@bitwarden/common/admin-console/models/collections";
import { Guid, UserId } from "@bitwarden/common/types/guid";

export class OrganizationUserView {
  id: Guid;
  userId: UserId;
  type: OrganizationUserType;
  revocationReason: RevocationReasonType;
  status: OrganizationUserStatusType;
  permissions: PermissionsApi;
  resetPasswordEnrolled: boolean = false;
  name: string | undefined;
  email: string;
  avatarColor: string;
  twoFactorEnabled: boolean = false;
  usesKeyConnector: boolean = false;
  hasMasterPassword: boolean = false;
  /**
   * True if this organizaztion user has been granted access to Secrets Manager, false otherwise.
   */
  accessSecretsManager: boolean = false;
  claimedByOrganization: boolean = false;

  collections: CollectionAccessSelectionView[] = [];
  groups: string[] = [];

  collectionNames: string[] = [];
  groupNames: string[] = [];

  constructor(c: {
    id: Guid;
    userId: UserId;
    email: string;
    type: OrganizationUserType;
    revocationReason: RevocationReasonType;
    status: OrganizationUserStatusType;
    permissions: PermissionsApi;
    avatarColor: string;
    name: string | undefined;
  }) {
    this.id = c.id;
    this.userId = c.userId;
    this.email = c.email;
    this.type = c.type;
    this.revocationReason = c.revocationReason;
    this.status = c.status;
    this.permissions = c.permissions;
    this.avatarColor = c.avatarColor;
    this.name = c.name;
  }

  static fromResponse(response: OrganizationUserUserDetailsResponse): OrganizationUserView {
    const view = new OrganizationUserView({
      id: response.id as Guid,
      userId: response.userId as UserId,
      email: response.email,
      type: response.type,
      revocationReason: response.revocationReason,
      status: response.status,
      permissions: response.permissions,
      avatarColor: response.avatarColor,
      name: response.name,
    });

    view.resetPasswordEnrolled = response.resetPasswordEnrolled;
    view.twoFactorEnabled = response.twoFactorEnabled;
    view.usesKeyConnector = response.usesKeyConnector;
    view.hasMasterPassword = response.hasMasterPassword;
    view.accessSecretsManager = response.accessSecretsManager;
    view.claimedByOrganization = response.claimedByOrganization;

    if (response.collections != undefined) {
      view.collections = response.collections.map((c) => new CollectionAccessSelectionView(c));
    }

    if (response.groups != undefined) {
      view.groups = response.groups;
    }

    return view;
  }
}
