// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Observable } from "rxjs";

import { OrganizationId } from "@bitwarden/common/types/guid";

import { MemberAccessProgressState } from "../model/member-access-progress";
import { MemberAccessExportItem } from "../view/member-access-export.view";
import { MemberAccessReportView } from "../view/member-access-report.view";

export abstract class MemberAccessReportServiceAbstraction {
  /** Observable for progress state updates during report generation */
  progress$: Observable<MemberAccessProgressState | null>;
  generateMemberAccessReportView: (
    organizationId: OrganizationId,
  ) => Promise<MemberAccessReportView[]>;
  generateUserReportExportItems: (
    organizationId: OrganizationId,
  ) => Promise<MemberAccessExportItem[]>;
}
