import { Guid, OrganizationId } from "@bitwarden/common/types/guid";

import { OrganizationUserView } from "../../../core/views/organization-user.view";

export const MemberDialogTab = Object.freeze({ Role: 0, Groups: 1, Collections: 2 } as const);
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

export interface AddMemberDialogParams extends CommonMemberDialogParams {
  kind: "Add";
  occupiedSeatCount: number;
  allOrganizationUsers: OrganizationUserView[];
}

export interface EditMemberDialogParams extends CommonMemberDialogParams {
  kind: "Edit";
  name: string;
  organizationUserId: Guid;
  usesKeyConnector: boolean;
  managedByOrganization?: boolean;
  initialTab: MemberDialogTab;
}

export type MemberDialogParams = EditMemberDialogParams | AddMemberDialogParams;
