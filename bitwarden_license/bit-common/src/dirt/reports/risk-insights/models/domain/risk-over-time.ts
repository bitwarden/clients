import Domain from "@bitwarden/common/platform/models/domain/domain-base";

import { RiskOverTimeData } from "../data/risk-over-time.data";

import { RiskOverTimeDataPoint } from "./risk-over-time-data-point";

/**
 * Domain model for risk-over-time chart data.
 *
 * - See {@link GetRiskOverTimeResponse} for API response model
 * - See {@link RiskOverTimeData} for data model
 * - See {@link RiskOverTimeView} for view model
 */
export class RiskOverTime extends Domain {
  // TODO: If encryption is added (PM-28531), timeframe/dataView may become EncString.
  // See concerns-and-gaps.md #4. [PM-28529]
  timeframe: string = "";
  dataView: string = "";
  dataPoints: RiskOverTimeDataPoint[] = [];

  constructor(data?: RiskOverTimeData) {
    super();
    if (data == null) {
      return;
    }

    this.timeframe = data.timeframe;
    this.dataView = data.dataView;

    if (data.dataPoints != null) {
      this.dataPoints = data.dataPoints.map((dp) => new RiskOverTimeDataPoint(dp));
    }
  }

  toRiskOverTimeData(): RiskOverTimeData {
    const d = new RiskOverTimeData();
    d.timeframe = this.timeframe;
    d.dataView = this.dataView;
    d.dataPoints = this.dataPoints.map((dp) => dp.toRiskOverTimeDataPointData());
    return d;
  }
}
