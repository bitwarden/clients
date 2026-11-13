import { Guid } from "@bitwarden/common/types/guid";
import { OrganizationUserView } from "@bitwarden/web-vault/app/admin-console/organizations/core";

export type MemberAccessReportView = {
  name: string;
  email: string;
  avatarColor: string;
  collectionsCount: number;
  groupsCount: number;
  itemsCount: number;
  userGuid: Guid;
  usesKeyConnector: boolean;
  userIdFromOrgUser: string | null; // maybe null and used for avatar
};

export type MemberAccessReportViewV2 = MemberAccessReportView & {
  /** The full organization member, which the edit member dialog is opened with. */
  member: OrganizationUserView;
};
