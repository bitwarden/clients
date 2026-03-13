import { View } from "@bitwarden/common/models/view/view";
import { DeepJsonify } from "@bitwarden/common/types/deep-jsonify";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { AccessReportSummaryApi } from "../api/access-report-summary.api";
import { AccessReportSummaryData } from "../data/access-report-summary.data";
import { AccessReportSummary } from "../domain/access-report-summary";

/**
 * View model for Report Summary in Access Intelligence containing decrypted properties
 *
 * - See {@link AccessReportSummary} for domain model
 * - See {@link AccessReportSummaryData} for data model
 * - See {@link AccessReportSummaryApi} for API model
 */
export class AccessReportSummaryView implements View {
  totalMemberCount: number = 0;
  totalApplicationCount: number = 0;
  totalAtRiskMemberCount: number = 0;
  totalAtRiskApplicationCount: number = 0;
  totalCriticalApplicationCount: number = 0;
  totalCriticalMemberCount: number = 0;
  totalCriticalAtRiskMemberCount: number = 0;
  totalCriticalAtRiskApplicationCount: number = 0;

  constructor(obj?: AccessReportSummary) {
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

  toJSON() {
    return this;
  }

  static fromData(data: AccessReportSummaryData): AccessReportSummaryView {
    const view = new AccessReportSummaryView();
    view.totalMemberCount = data.totalMemberCount;
    view.totalApplicationCount = data.totalApplicationCount;
    view.totalAtRiskMemberCount = data.totalAtRiskMemberCount;
    view.totalAtRiskApplicationCount = data.totalAtRiskApplicationCount;
    view.totalCriticalApplicationCount = data.totalCriticalApplicationCount;
    view.totalCriticalMemberCount = data.totalCriticalMemberCount;
    view.totalCriticalAtRiskMemberCount = data.totalCriticalAtRiskMemberCount;
    view.totalCriticalAtRiskApplicationCount = data.totalCriticalAtRiskApplicationCount;
    return view;
  }

  static fromJSON(obj: Partial<DeepJsonify<AccessReportSummaryView>>): AccessReportSummaryView {
    return Object.assign(new AccessReportSummaryView(), obj);
  }

  // [TODO] SDK Mapping
  // toSdkAccessReportSummaryView(): SdkAccessReportSummaryView {}
  // static fromAccessReportSummaryView(obj?: SdkAccessReportSummaryView): AccessReportSummaryView | undefined {}
}
