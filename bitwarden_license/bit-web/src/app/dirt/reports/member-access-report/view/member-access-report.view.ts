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
  /** The full organization member, which the edit member dialog is opened with. */
  member: OrganizationUserView;
};

/** The deprecated V1 report reads members from a different endpoint, so it has no `member`. */
export type MemberAccessReportViewV1 = Omit<MemberAccessReportView, "member">;
