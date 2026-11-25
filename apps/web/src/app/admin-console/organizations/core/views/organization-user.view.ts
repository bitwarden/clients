import { OrganizationUserUserDetailsResponse } from "@bitwarden/admin-console/common";
import { OrganizationUserType, RevocationReasonType } from "@bitwarden/common/admin-console/enums";
import { PermissionsApi } from "@bitwarden/common/admin-console/models/api/permissions.api";
import { CollectionAccessSelectionView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { Guid, UserId } from "@bitwarden/common/types/guid";
import { OrganizationUserStatusType } from "@bitwarden/sdk-internal";

export class OrganizationUserView {
  id: Guid;
  userId: UserId;
  type: OrganizationUserType;
  revocationReason: RevocationReasonType;
  readonly status: OrganizationUserStatusType;
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
  /**
   * True if this organization user has been granted access to Privileged Controls, false otherwise.
   */
  accessPam: boolean = false;
  claimedByOrganization: boolean = false;

  collections: CollectionAccessSelectionView[] = [];
  groups: string[] = [];

  collectionNames: string[] = [];
  groupNames: string[] = [];

  readonly canConfirm: boolean;
  readonly canReinvite: boolean;
  readonly canSendInvite: boolean;
  readonly canRestore: boolean;
  readonly canRevoke: boolean;
  readonly canRemove: boolean;

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
    claimedByOrganization?: boolean;
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
    this.claimedByOrganization = c.claimedByOrganization ?? false;

    this.canConfirm = this.status === OrganizationUserStatusType.Accepted;
    this.canReinvite = this.status === OrganizationUserStatusType.Invited;
    this.canSendInvite = this.status === OrganizationUserStatusType.Staged;
    this.canRestore = this.status === OrganizationUserStatusType.Revoked;
    this.canRevoke = this.status !== OrganizationUserStatusType.Revoked;
    this.canRemove = !this.claimedByOrganization;
  }

  /** Whether this member is the signed-in admin themselves. */
  isSelf(organization: Organization): boolean {
    return this.userId != null && this.userId === organization.userId;
  }

  /**
   * Mirrors the server: only Owners (including Provider users) act on Owners, and Custom users
   * can't act on Admins.
   */
  canBeActedOnBy(organization: Organization): boolean {
    if (this.type === OrganizationUserType.Owner) {
      return organization.isOwner;
    }
    if (this.type === OrganizationUserType.Admin) {
      return organization.isOwner || organization.type === OrganizationUserType.Admin;
    }
    return true;
  }

  canRestoreAccess(organization: Organization): boolean {
    return this.canRestore && this.canBeActedOnBy(organization);
  }

  canRevokeAccess(organization: Organization): boolean {
    return this.canRevoke && this.canBeActedOnBy(organization);
  }

  canRemoveFromOrg(organization: Organization): boolean {
    return this.canRemove && this.canBeActedOnBy(organization);
  }

  /** Only accounts the organization claims, once they've accepted, can be deleted. */
  canDeleteAccount(organization: Organization): boolean {
    return (
      this.claimedByOrganization &&
      [
        OrganizationUserStatusType.Accepted,
        OrganizationUserStatusType.Confirmed,
        OrganizationUserStatusType.Revoked,
      ].includes(this.status) &&
      this.canBeActedOnBy(organization)
    );
  }

  canAddToSecretsManager(organization: Organization): boolean {
    return (
      organization.useSecretsManager &&
      !this.accessSecretsManager &&
      this.status !== OrganizationUserStatusType.Revoked
    );
  }

  canAddToPrivilegedControls(organization: Organization): boolean {
    return (
      organization.usePam && !this.accessPam && this.status !== OrganizationUserStatusType.Revoked
    );
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
      claimedByOrganization: response.claimedByOrganization,
    });

    view.resetPasswordEnrolled = response.resetPasswordEnrolled;
    view.twoFactorEnabled = response.twoFactorEnabled;
    view.usesKeyConnector = response.usesKeyConnector;
    view.hasMasterPassword = response.hasMasterPassword;
    view.accessSecretsManager = response.accessSecretsManager;
    view.accessPam = response.accessPam;

    if (response.collections != undefined) {
      view.collections = response.collections.map((c) => new CollectionAccessSelectionView(c));
    }

    if (response.groups != undefined) {
      view.groups = response.groups;
    }

    return view;
  }
}
