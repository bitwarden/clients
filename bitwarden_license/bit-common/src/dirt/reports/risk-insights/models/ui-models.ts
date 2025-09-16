import { MemberDetailsFlat } from "./domain-models";

// -------------------- UI Enums --------------------
// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum DrawerType {
  None = 0,
  AppAtRiskMembers = 1,
  OrgAtRiskMembers = 2,
  OrgAtRiskApps = 3,
}

// -------------------- Dialog and UI Models --------------------
export type AppAtRiskMembersDialogParams = {
  members: MemberDetailsFlat[];
  applicationName: string;
};
