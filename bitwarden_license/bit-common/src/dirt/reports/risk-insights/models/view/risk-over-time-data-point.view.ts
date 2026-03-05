import { View } from "@bitwarden/common/models/view/view";
import { DeepJsonify } from "@bitwarden/common/types/deep-jsonify";

import { RiskOverTimeDataPoint } from "../domain/risk-over-time-data-point";

/**
 * View model for a single data point in risk-over-time chart data.
 * Contains the date and decrypted atRisk/total counts ready for chart rendering.
 *
 * - See {@link RiskOverTimeSummaryEntryResponse} for API model
 * - See {@link RiskOverTimeDataPointData} for data model
 * - See {@link RiskOverTimeDataPoint} for domain model
 */
export class RiskOverTimeDataPointView implements View {
  date: string = "";
  atRisk: number = 0;
  total: number = 0;

  constructor(data?: RiskOverTimeDataPoint) {
    if (data == null) {
      return;
    }

    this.date = data.date;
    this.atRisk = data.atRisk;
    this.total = data.total;
  }

  toJSON() {
    return this;
  }

  static fromJSON(
    obj: Partial<DeepJsonify<RiskOverTimeDataPointView>> | undefined,
  ): RiskOverTimeDataPointView | undefined {
    return Object.assign(new RiskOverTimeDataPointView(), obj);
  }
}
