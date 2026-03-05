import Domain from "@bitwarden/common/platform/models/domain/domain-base";

import { RiskOverTimeData } from "../data/risk-over-time.data";

import { RiskOverTimeDataPoint } from "./risk-over-time-data-point";

/**
 * Domain model for risk-over-time chart data.
 *
 * Contains an array of data points, each with a date and atRisk/total counts
 * extracted from decrypted OrganizationReportSummary entries for the selected
 * RiskOverTimeDataView.
 *
 * - See {@link RiskOverTimeSummaryEntryResponse} for API response model
 * - See {@link RiskOverTimeData} for data model
 * - See {@link RiskOverTimeView} for view model
 */
export class RiskOverTime extends Domain {
  dataPoints: RiskOverTimeDataPoint[] = [];

  constructor(data?: RiskOverTimeData) {
    super();
    if (data == null) {
      return;
    }

    if (data.dataPoints != null) {
      this.dataPoints = data.dataPoints.map((dp) => new RiskOverTimeDataPoint(dp));
    }
  }

  toRiskOverTimeData(): RiskOverTimeData {
    const d = new RiskOverTimeData();
    d.dataPoints = this.dataPoints.map((dp) => dp.toRiskOverTimeDataPointData());
    return d;
  }
}
