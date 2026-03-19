import { AccessReportSummaryApi } from "../api/access-report-summary.api";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { AccessReportSummary } from "../domain/access-report-summary";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { AccessReportSummaryView } from "../view/access-report-summary.view";

/**
 * Serializable data model for report summary in access report
 *
 * - See {@link AccessReportSummary} for domain model
 * - See {@link AccessReportSummaryApi} for API model
 * - See {@link AccessReportSummaryView} from View Model
 */
export class AccessReportSummaryData {
  totalMemberCount: number = 0;
  totalApplicationCount: number = 0;
  totalAtRiskMemberCount: number = 0;
  totalAtRiskApplicationCount: number = 0;
  totalCriticalApplicationCount: number = 0;
  totalCriticalMemberCount: number = 0;
  totalCriticalAtRiskMemberCount: number = 0;
  totalCriticalAtRiskApplicationCount: number = 0;

  constructor(data?: AccessReportSummaryApi) {
    if (data == null) {
      return;
    }

    this.totalMemberCount = data.totalMemberCount;
    this.totalApplicationCount = data.totalApplicationCount;
    this.totalAtRiskMemberCount = data.totalAtRiskMemberCount;
    this.totalAtRiskApplicationCount = data.totalAtRiskApplicationCount;
    this.totalCriticalApplicationCount = data.totalCriticalApplicationCount;
    this.totalCriticalMemberCount = data.totalCriticalMemberCount;
    this.totalCriticalAtRiskMemberCount = data.totalCriticalAtRiskMemberCount;
    this.totalCriticalAtRiskApplicationCount = data.totalCriticalAtRiskApplicationCount;
  }
}
