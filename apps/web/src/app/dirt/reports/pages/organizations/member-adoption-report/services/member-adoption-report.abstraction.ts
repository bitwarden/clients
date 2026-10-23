import { OrganizationId } from "@bitwarden/common/types/guid";

import {
  MemberAdoptionExportItem,
  MemberAdoptionReportView,
} from "../view/member-adoption-report.view";

export abstract class MemberAdoptionReportServiceAbstraction {
  abstract getMemberAdoptionReport(
    organizationId: OrganizationId,
  ): Promise<MemberAdoptionReportView>;

  abstract getMemberAdoptionExportItems(
    organizationId: OrganizationId,
  ): Promise<MemberAdoptionExportItem[]>;
}
