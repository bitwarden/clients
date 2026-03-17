import { BaseResponse } from "@bitwarden/common/models/response/base.response";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { AccessReportSummaryData } from "../data/access-report-summary.data";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { AccessReportSummary } from "../domain/access-report-summary";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { AccessReportSummaryView } from "../view/access-report-summary.view";

/**
 * Converts an AccessReportSummary API response
 *
 * - See {@link AccessReportSummary} for domain model
 * - See {@link AccessReportSummaryData} for data model
 * - See {@link AccessReportSummaryView} from View Model
 */
export class AccessReportSummaryApi extends BaseResponse {
  totalMemberCount: number = 0;
  totalApplicationCount: number = 0;
  totalAtRiskMemberCount: number = 0;
  totalAtRiskApplicationCount: number = 0;
  totalCriticalApplicationCount: number = 0;
  totalCriticalMemberCount: number = 0;
  totalCriticalAtRiskMemberCount: number = 0;
  totalCriticalAtRiskApplicationCount: number = 0;

  constructor(data: any) {
    super(data);

    this.totalMemberCount = this.getResponseProperty("totalMemberCount") || 0;
    this.totalApplicationCount = this.getResponseProperty("totalApplicationCount") || 0;
    this.totalAtRiskMemberCount = this.getResponseProperty("totalAtRiskMemberCount") || 0;
    this.totalAtRiskApplicationCount = this.getResponseProperty("totalAtRiskApplicationCount") || 0;
    this.totalCriticalApplicationCount =
      this.getResponseProperty("totalCriticalApplicationCount") || 0;
    this.totalCriticalMemberCount = this.getResponseProperty("totalCriticalMemberCount") || 0;
    this.totalCriticalAtRiskMemberCount =
      this.getResponseProperty("totalCriticalAtRiskMemberCount") || 0;
    this.totalCriticalAtRiskApplicationCount =
      this.getResponseProperty("totalCriticalAtRiskApplicationCount") || 0;
  }
}
