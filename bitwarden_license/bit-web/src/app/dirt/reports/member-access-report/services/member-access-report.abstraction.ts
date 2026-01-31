import { Observable } from "rxjs";

import { OrganizationId } from "@bitwarden/common/types/guid";

import { MemberAccessProgressState } from "../model/member-access-progress";
import { MemberAccessExportItem } from "../view/member-access-export.view";
import { MemberAccessReportView } from "../view/member-access-report.view";

export abstract class MemberAccessReportServiceAbstraction {
  /** Observable for progress state updates during report generation */
  abstract readonly progress$: Observable<MemberAccessProgressState | null>;
  abstract generateMemberAccessReportView(
    organizationId: OrganizationId,
  ): Promise<MemberAccessReportView[]>;
  abstract generateUserReportExportItems(
    organizationId: OrganizationId,
  ): Promise<MemberAccessExportItem[]>;
}
