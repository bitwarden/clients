import { BaseResponse } from "@bitwarden/common/models/response/base.response";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { AccessReportSummaryData } from "../data/access-report-summary.data";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { AccessReportSummary } from "../domain/access-report-summary";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { AccessReportSummaryView } from "../view/access-report-summary.view";

/**
 * API response model for an encrypted access report summary entry.
 *
 * - See {@link AccessReportSummary} for domain model
 * - See {@link AccessReportSummaryData} for data model
 * - See {@link AccessReportSummaryView} for view model
 */
export class AccessReportSummaryApi extends BaseResponse {
  organizationId: string = "";
  encryptedData: string = "";
  encryptionKey: string = "";
  date: string = "";

  constructor(data: any) {
    super(data);

    this.organizationId = this.getResponseProperty("OrganizationId") ?? "";
    this.encryptedData = this.getResponseProperty("EncryptedData") ?? "";
    this.encryptionKey = this.getResponseProperty("EncryptionKey") ?? "";
    this.date = this.getResponseProperty("Date") ?? "";
  }
}
