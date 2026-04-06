import { Jsonify } from "type-fest";

import { View } from "@bitwarden/common/models/view/view";

import { AccessReportMetrics } from "../domain/access-report-metrics";

export class AccessReportMetricsView implements View {
  totalApplicationCount: number = 0;
  totalAtRiskApplicationCount: number = 0;
  totalCriticalApplicationCount: number = 0;
  totalCriticalAtRiskApplicationCount: number = 0;
  totalMemberCount: number = 0;
  totalAtRiskMemberCount: number = 0;
  totalCriticalMemberCount: number = 0;
  totalCriticalAtRiskMemberCount: number = 0;
  totalPasswordCount: number = 0;
  totalAtRiskPasswordCount: number = 0;
  totalCriticalPasswordCount: number = 0;
  totalCriticalAtRiskPasswordCount: number = 0;

  constructor(data?: AccessReportMetrics) {
    if (data == null) {
      return;
    }
    this.totalApplicationCount = data.totalApplicationCount;
    this.totalAtRiskApplicationCount = data.totalAtRiskApplicationCount;
    this.totalCriticalApplicationCount = data.totalCriticalApplicationCount;
    this.totalCriticalAtRiskApplicationCount = data.totalCriticalAtRiskApplicationCount;
    this.totalMemberCount = data.totalMemberCount;
    this.totalAtRiskMemberCount = data.totalAtRiskMemberCount;
    this.totalCriticalMemberCount = data.totalCriticalMemberCount;
    this.totalCriticalAtRiskMemberCount = data.totalCriticalAtRiskMemberCount;
    this.totalPasswordCount = data.totalPasswordCount;
    this.totalAtRiskPasswordCount = data.totalAtRiskPasswordCount;
    this.totalCriticalPasswordCount = data.totalCriticalPasswordCount;
    this.totalCriticalAtRiskPasswordCount = data.totalCriticalAtRiskPasswordCount;
  }

  toJSON() {
    return this;
  }

  static fromJSON(
    obj: Partial<Jsonify<AccessReportMetricsView>>,
  ): AccessReportMetricsView | undefined {
    return Object.assign(new AccessReportMetricsView(), obj);
  }

  // toSdkAccessReportMetricsView(): SdkAccessReportMetricsView {}

  // static fromAccessReportMetricsView(obj?: SdkAccessReportMetricsView): AccessReportMetricsView | undefined {}
}
