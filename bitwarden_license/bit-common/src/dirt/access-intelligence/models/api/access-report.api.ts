import { BaseResponse } from "@bitwarden/common/models/response/base.response";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { AccessReportData } from "../data/access-report.data";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { AccessReport } from "../domain/access-report";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { AccessReportView } from "../view/access-report.view";

/**
 * Converts an AccessReport API response
 *
 * - See {@link AccessReport} for domain model
 * - See {@link AccessReportData} for data model
 * - See {@link AccessReportView} from View Model
 */
// [TODO] To replace legacy V1 report response type
export class AccessReportApi extends BaseResponse {
  id: string = "";
  organizationId: string = "";
  reports: string = "";
  applications: string = "";
  summary: string = "";
  memberRegistry: string = "";
  creationDate: string = "";
  contentEncryptionKey: string = "";
  reportFile?: string;
  reportFileDownloadUrl?: string;

  constructor(data: any = null) {
    super(data);
    if (data == null) {
      return;
    }

    this.id = this.getResponseProperty("id");
    this.organizationId = this.getResponseProperty("organizationId");
    this.creationDate = this.getResponseProperty("creationDate");
    this.reports = this.getResponseProperty("reportData");
    this.applications = this.getResponseProperty("applicationData");
    this.summary = this.getResponseProperty("summaryData");
    this.memberRegistry = this.getResponseProperty("memberRegistry") ?? "";
    this.contentEncryptionKey = this.getResponseProperty("contentEncryptionKey");
    this.reportFile = this.getResponseProperty("reportFile") ?? undefined;
    this.reportFileDownloadUrl = this.getResponseProperty("reportFileDownloadUrl") ?? undefined;

    // Use when individual values are encrypted
    // const summary = this.getResponseProperty("summaryData");
    // if (summary != null) {
    //   this.summary = new AccessReportSummaryApi(summary);
    // }

    // const reports = this.getResponseProperty("reportData");
    // if (reports != null) {
    //   this.reports = reports.map((r: any) => new ApplicationHealthApi(r));
    // }
    // const applications = this.getResponseProperty("applicationData");
    // if (applications != null) {
    //   this.applications = applications.map((f: any) => new AccessReportSettingsApi(f));
    // }
  }
}
