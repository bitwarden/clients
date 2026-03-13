import { DrawerType } from "../../../access-intelligence/services";

import { MemberDetails } from "./report-models";

// -------------------- Drawer and UI Models --------------------

export type DrawerDetails = {
  open: boolean;
  invokerId: string;
  activeDrawerType: DrawerType;
  atRiskMemberDetails?: AtRiskMemberDetail[];
  appAtRiskMembers?: AppAtRiskMembersDialogParams | null;
  atRiskAppDetails?: AtRiskApplicationDetail[] | null;
};

export type AppAtRiskMembersDialogParams = {
  members: MemberDetails[];
  applicationName: string;
};

/**
 * Member email with the number of at risk passwords
 * At risk member detail that contains the email
 * and the count of at risk ciphers
 */
export type AtRiskMemberDetail = {
  email: string;
  atRiskPasswordCount: number;
};

/*
 * A list of applications and the count of
 * at risk passwords for each application
 */
export type AtRiskApplicationDetail = {
  applicationName: string;
  atRiskPasswordCount: number;
};
