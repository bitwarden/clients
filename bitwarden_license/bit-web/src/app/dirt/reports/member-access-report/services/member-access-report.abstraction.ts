// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { OrganizationId } from "@bitwarden/common/types/guid";

import { MemberAccessExportItem } from "../view/member-access-export.view";
import { MemberAccessReportView } from "../view/member-access-report.view";

export abstract class MemberAccessReportServiceAbstraction {
  generateMemberAccessReportView: (
    organizationId: OrganizationId,
  ) => Promise<MemberAccessReportView[]>;
  generateUserReportExportItems: (
    organizationId: OrganizationId,
  ) => Promise<MemberAccessExportItem[]>;
}
