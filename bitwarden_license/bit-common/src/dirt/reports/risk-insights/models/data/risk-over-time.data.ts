import { GetRiskOverTimeResponse } from "../api-models.types";

import { RiskOverTimeDataPointData } from "./risk-over-time-data-point.data";

/**
 * Serializable data model for risk-over-time chart data.
 *
 * - See {@link GetRiskOverTimeResponse} for API response model
 * - See {@link RiskOverTime} for domain model
 * - See {@link RiskOverTimeView} for view model
 */
export class RiskOverTimeData {
  timeframe: string = "";
  dataView: string = "";
  dataPoints: RiskOverTimeDataPointData[] = [];

  // TODO: If encryption is added, this constructor may accept a RiskOverTimeApi class
  // instead of GetRiskOverTimeResponse (Solution B approach). See concerns-and-gaps.md #4. [PM-28529]
  constructor(data?: GetRiskOverTimeResponse) {
    if (data == null) {
      return;
    }

    this.timeframe = data.timeframe;
    this.dataView = data.dataView;

    if (data.dataPoints != null) {
      this.dataPoints = data.dataPoints.map((dp) => new RiskOverTimeDataPointData(dp));
    }
  }
}
