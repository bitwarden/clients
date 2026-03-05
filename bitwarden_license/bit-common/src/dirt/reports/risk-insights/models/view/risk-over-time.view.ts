import { View } from "@bitwarden/common/models/view/view";
import { DeepJsonify } from "@bitwarden/common/types/deep-jsonify";

import { RiskOverTime } from "../domain/risk-over-time";

import { RiskOverTimeDataPointView } from "./risk-over-time-data-point.view";

/**
 * View model for risk-over-time chart data containing decrypted data points.
 *
 * - See {@link RiskOverTimeSummaryEntryResponse} for API response model
 * - See {@link RiskOverTimeData} for data model
 * - See {@link RiskOverTime} for domain model
 */
export class RiskOverTimeView implements View {
  dataPoints: RiskOverTimeDataPointView[] = [];

  constructor(data?: RiskOverTime) {
    if (data == null) {
      return;
    }

    if (data.dataPoints != null) {
      this.dataPoints = data.dataPoints.map((dp) => new RiskOverTimeDataPointView(dp));
    }
  }

  toJSON() {
    return this;
  }

  static fromJSON(
    obj: Partial<DeepJsonify<RiskOverTimeView>> | undefined,
  ): RiskOverTimeView | undefined {
    if (obj == null) {
      return undefined;
    }

    const view = Object.assign(new RiskOverTimeView(), obj) as RiskOverTimeView;

    view.dataPoints =
      obj.dataPoints
        ?.map((dp: any) => RiskOverTimeDataPointView.fromJSON(dp))
        .filter((dp): dp is RiskOverTimeDataPointView => dp !== undefined) ?? [];

    return view;
  }
}
