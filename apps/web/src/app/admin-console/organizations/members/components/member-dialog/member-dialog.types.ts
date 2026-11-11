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

interface BaseEditMemberDialogParams extends CommonMemberDialogParams {
  initialTab: MemberDialogTab;
  createdDate?: Date;
}

/** Opens the dialog from the members list, which already has the member's row. */
export interface EditMemberFromListDialogParams extends BaseEditMemberDialogParams {
  member: OrganizationUserView;
  /**
   * Disables the form and hides Save, Remove and Revoke. Defaults to false. A readonly dialog
   * reads the member from `member`, since reading a single member requires Manage users.
   */
  readonly?: boolean;
}

/** Opens the dialog from places that only know the member's ID, such as the member access report. */
export interface EditMemberByIdDialogParams extends BaseEditMemberDialogParams {
  organizationUserId: Guid;
  name: string;
  usesKeyConnector: boolean;
}

export type EditMemberDialogParams = EditMemberFromListDialogParams | EditMemberByIdDialogParams;
