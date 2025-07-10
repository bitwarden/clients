// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import {
  OrganizationUserUserDetailsResponse,
  CollectionAccessSelectionView,
} from "@bitwarden/admin-console/common";
import {
  OrganizationUserStatusType,
  OrganizationUserType,
} from "@bitwarden/common/admin-console/enums";
import { PermissionsApi } from "@bitwarden/common/admin-console/models/api/permissions.api";

export class OrganizationUserView {
  id: string;
  userId: string;
  type: OrganizationUserType;
  status: OrganizationUserStatusType;
  permissions: PermissionsApi;
  resetPasswordEnrolled: boolean;
  name: string;
  email: string;
  avatarColor: string;
  twoFactorEnabled: boolean;
  usesKeyConnector: boolean;
  hasMasterPassword: boolean;
  /**
   * True if this organizaztion user has been granted access to Secrets Manager, false otherwise.
   */
  accessSecretsManager: boolean;
  managedByOrganization: boolean;

  collections: CollectionAccessSelectionView[] = [];
  groups: string[] = [];

  groupNames: string[] = [];
  collectionNames: string[] = [];

  static fromResponse(response: OrganizationUserUserDetailsResponse): OrganizationUserView {
    const view = Object.assign(new OrganizationUserView(), response) as OrganizationUserView;

    if (response.collections != undefined) {
      view.collections = response.collections.map((c) => new CollectionAccessSelectionView(c));
    }

    if (response.groups != undefined) {
      view.groups = response.groups;
    }

    return view;
  }
}
