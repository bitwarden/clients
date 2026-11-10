import { Guid, OrganizationId } from "@bitwarden/common/types/guid";

import { OrganizationUserView } from "../../../core/views/organization-user.view";

export const MemberDialogTab = Object.freeze({
  Details: 0,
  Groups: 1,
  Collections: 2,
} as const);
export type MemberDialogTab = (typeof MemberDialogTab)[keyof typeof MemberDialogTab];

export const MemberDialogResult = Object.freeze({
  Saved: "saved",
  Canceled: "canceled",
  Deleted: "deleted",
  Revoked: "revoked",
  Restored: "restored",
} as const);
export type MemberDialogResult = (typeof MemberDialogResult)[keyof typeof MemberDialogResult];

interface CommonMemberDialogParams {
  isOnSecretsManagerStandalone: boolean;
  organizationId: OrganizationId;
}

export interface EditMemberDialogParams extends CommonMemberDialogParams {
  name: string;
  profileName?: string;
  email?: string;
  createdDate?: Date;
  organizationUserId: Guid;
  usesKeyConnector: boolean;
  claimedByOrganization?: boolean;
  hasMasterPassword?: boolean;
  initialTab: MemberDialogTab;
  /** Disables the form and hides Save, Remove and Revoke. Defaults to false. */
  readonly?: boolean;
  /**
   * The member's row from the members list. A readonly dialog reads the member from here, since
   * reading a single member requires the Manage users permission.
   */
  member?: OrganizationUserView;
}
