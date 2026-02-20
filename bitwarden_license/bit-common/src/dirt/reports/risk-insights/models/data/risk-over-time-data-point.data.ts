import { RiskOverTimeDataPointApi } from "../api/risk-over-time-data-point.api";

/**
 * Serializable data model for a single data point in risk-over-time chart data.
 *
 * - See {@link RiskOverTimeDataPointApi} for API model
 * - See {@link RiskOverTimeDataPoint} for domain model
 * - See {@link RiskOverTimeDataPointView} for view model
 */
export class RiskOverTimeDataPointData {
  timestamp: string = "";
  atRisk: number = 0;
  total: number = 0;

  constructor(data?: RiskOverTimeDataPointApi) {
    if (data == null) {
      return;
    }

    this.timestamp = data.timestamp;
    this.atRisk = data.atRisk;
    this.total = data.total;
  }
}
