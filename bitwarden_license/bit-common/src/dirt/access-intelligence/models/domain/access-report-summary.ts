import Domain from "@bitwarden/common/platform/models/domain/domain-base";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { AccessReportSummaryApi } from "../api/access-report-summary.api";
import { AccessReportSummaryData } from "../data/access-report-summary.data";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { AccessReportSummaryView } from "../view/access-report-summary.view";

/**
 * Domain model for report summary in Access Intelligence containing encrypted properties
 *
 * - See {@link AccessReportSummaryApi} for API model
 * - See {@link AccessReportSummaryData} for data model
 * - See {@link AccessReportSummaryView} from View Model
 */
export class AccessReportSummary extends Domain {
  totalMemberCount: number = 0;
  totalApplicationCount: number = 0;
  totalAtRiskMemberCount: number = 0;
  totalAtRiskApplicationCount: number = 0;
  totalCriticalApplicationCount: number = 0;
  totalCriticalMemberCount: number = 0;
  totalCriticalAtRiskMemberCount: number = 0;
  totalCriticalAtRiskApplicationCount: number = 0;

  constructor(obj?: AccessReportSummaryData) {
    super();
    if (obj == null) {
      return;
    }

    this.totalMemberCount = obj.totalMemberCount;
    this.totalApplicationCount = obj.totalApplicationCount;
    this.totalAtRiskMemberCount = obj.totalAtRiskMemberCount;
    this.totalAtRiskApplicationCount = obj.totalAtRiskApplicationCount;
    this.totalCriticalApplicationCount = obj.totalCriticalApplicationCount;
    this.totalCriticalMemberCount = obj.totalCriticalMemberCount;
    this.totalCriticalAtRiskMemberCount = obj.totalCriticalAtRiskMemberCount;
    this.totalCriticalAtRiskApplicationCount = obj.totalCriticalAtRiskApplicationCount;
  }

  // [TODO] Domain level methods
  // static fromJSON(): AccessReportSummary {}
  // decrypt(): AccessReportSummaryView {}
  // toData(): AccessReportSummaryData {}

  // [TODO] SDK Mapping
  // toSdkAccessReportSummary(): SdkAccessReportSummary {}
  // static fromSdkAccessReportSummary(obj?: SdkAccessReportSummary): AccessReportSummary | undefined {}
}
