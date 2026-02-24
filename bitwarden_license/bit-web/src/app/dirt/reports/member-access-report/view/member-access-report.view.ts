import { Guid } from "@bitwarden/common/types/guid";

export type MemberAccessReportView = {
  name: string;
  email: string;
  avatarColor: string;
  collectionsCount: number;
  groupsCount: number;
  itemsCount: number;
  userGuid: Guid;
  usesKeyConnector: boolean;
};
