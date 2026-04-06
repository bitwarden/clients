import { View } from "@bitwarden/common/models/view/view";
import { DeepJsonify } from "@bitwarden/common/types/deep-jsonify";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { AccessReportSummaryApi } from "../api/access-report-summary.api";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { AccessReportSummaryData } from "../data/access-report-summary.data";
import { AccessReportSummary } from "../domain/access-report-summary";

/**
 * Decrypted aggregate summary of an organization's access report.
 * Contains counts of members, applications, and passwords across risk categories.
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
  totalPasswordCount: number = 0;
  totalAtRiskPasswordCount: number = 0;
  totalCriticalPasswordCount: number = 0;
  totalCriticalAtRiskPasswordCount: number = 0;
  date: Date = new Date(0);

  constructor(obj?: AccessReportSummary) {
    if (obj == null) {
      return;
    }

    this.date = obj.date;
  }

  toJSON() {
    return this;
  }

  static fromJSON(obj: Partial<DeepJsonify<AccessReportSummaryView>>): AccessReportSummaryView {
    return Object.assign(new AccessReportSummaryView(), obj, {
      date: obj.date ? new Date(obj.date as unknown as string) : new Date(0),
      // Old blobs pre-date password counts — coerce missing fields to 0
      totalPasswordCount: obj.totalPasswordCount ?? 0,
      totalAtRiskPasswordCount: obj.totalAtRiskPasswordCount ?? 0,
      totalCriticalPasswordCount: obj.totalCriticalPasswordCount ?? 0,
      totalCriticalAtRiskPasswordCount: obj.totalCriticalAtRiskPasswordCount ?? 0,
    });
  }
}
