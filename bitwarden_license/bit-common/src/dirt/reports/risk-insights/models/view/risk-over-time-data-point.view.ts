import { Jsonify } from "type-fest";

import { View } from "@bitwarden/common/models/view/view";

import { RiskOverTimeDataPoint } from "../domain/risk-over-time-data-point";

/**
 * View model for a single data point in risk-over-time chart data.
 *
 * - See {@link RiskOverTimeDataPointApi} for API model
 * - See {@link RiskOverTimeDataPointData} for data model
 * - See {@link RiskOverTimeDataPoint} for domain model
 */
export class RiskOverTimeDataPointView implements View {
  timestamp: string = "";
  atRisk: number = 0;
  total: number = 0;

  constructor(data?: RiskOverTimeDataPoint) {
    if (data == null) {
      return;
    }

    this.timestamp = data.timestamp;
    this.atRisk = data.atRisk;
    this.total = data.total;
  }

  toJSON() {
    return this;
  }

  static fromJSON(
    obj: Partial<Jsonify<RiskOverTimeDataPointView>>,
  ): RiskOverTimeDataPointView | undefined {
    return Object.assign(new RiskOverTimeDataPointView(), obj);
  }
}
