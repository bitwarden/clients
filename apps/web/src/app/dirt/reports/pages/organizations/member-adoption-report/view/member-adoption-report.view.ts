import { Guid, UserId } from "@bitwarden/common/types/guid";

export type MemberAdoptionMemberView = {
  organizationUserId: Guid;
  /** `null` for a member who has been invited but has no account yet. */
  userId: UserId | null;
  /** May be empty: the table falls back to the email address. */
  name: string;
  email: string;
  hasRecentLogin: boolean;
  hasExtensionInstalled: boolean;
  vaultItemCount: number;
  sharedItemCount: number;
};

export type MemberAdoptionReportView = {
  totalMemberCount: number;
  activeMemberCount: number;
  inactiveMemberCount: number;
  sponsoredFamiliesRedeemedCount: number;
  members: MemberAdoptionMemberView[];
};

/** Every field is a display string: the booleans are already localized. */
export type MemberAdoptionExportItem = {
  name: string;
  email: string;
  recentLogin: string;
  extensionInstalled: string;
  vaultItems: string;
  itemsSharedWithThem: string;
};

/** Untranslated, like the other DIRT report exports. */
export const memberAdoptionExportHeaders: { [key in keyof MemberAdoptionExportItem]: string } = {
  name: "Name",
  email: "Email",
  recentLogin: "Recent login",
  extensionInstalled: "Extension used",
  vaultItems: "Vault items",
  itemsSharedWithThem: "Shared items",
};
