import { Guid } from "@bitwarden/common/types/guid";

export type MemberAccessReportView = {
  name: string;
  email: string;
  collectionsCount: number;
  groupsCount: number;
  itemsCount: number;
  userGuid: Guid;
  userId?: string;
  avatarColor?: string;
  usesKeyConnector: boolean;
};
