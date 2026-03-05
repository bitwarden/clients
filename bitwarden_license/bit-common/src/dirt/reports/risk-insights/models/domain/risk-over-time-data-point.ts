import Domain from "@bitwarden/common/platform/models/domain/domain-base";

import { RiskOverTimeDataPointData } from "../data/risk-over-time-data-point.data";

/**
 * Domain model for a single data point in risk-over-time chart data.
 *
 * After decryption of the encrypted summary entry, this model holds the
 * extracted date and metric counts (atRisk/total) for the selected data view.
 *
 * - See {@link RiskOverTimeSummaryEntryResponse} for API model
 * - See {@link RiskOverTimeDataPointData} for data model
 * - See {@link RiskOverTimeDataPointView} for view model
 */
export class RiskOverTimeDataPoint extends Domain {
  date: string = "";
  atRisk: number = 0;
  total: number = 0;

  constructor(data?: RiskOverTimeDataPointData) {
    super();
    if (data == null) {
      return;
    }

    this.date = data.date;
    this.atRisk = data.atRisk;
    this.total = data.total;
  }

  toRiskOverTimeDataPointData(): RiskOverTimeDataPointData {
    const d = new RiskOverTimeDataPointData();
    d.date = this.date;
    d.atRisk = this.atRisk;
    d.total = this.total;
    return d;
  }
}
