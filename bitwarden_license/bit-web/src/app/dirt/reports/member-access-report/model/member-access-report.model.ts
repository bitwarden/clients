import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";

/**
 * Details for the parents MemberAccessReport
 */
export type MemberAccessDetails = {
  collectionId: string;
  groupId: string;
  groupName: string;
  // Comes encrypted from the server
  collectionName: EncString;
  itemCount: number;
  readOnly: boolean;
  hidePasswords: boolean;
  manage: boolean;
};
