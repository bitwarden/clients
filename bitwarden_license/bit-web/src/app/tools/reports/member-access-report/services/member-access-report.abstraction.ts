import { OrganizationId } from "@bitwarden/common/src/types/guid";

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
