import { Jsonify } from "type-fest";

import { View } from "@bitwarden/common/models/view/view";

import { RiskOverTime } from "../domain/risk-over-time";

import { RiskOverTimeDataPointView } from "./risk-over-time-data-point.view";

/**
 * View model for risk-over-time chart data containing decrypted properties.
 *
 * - See {@link GetRiskOverTimeResponse} for API response model
 * - See {@link RiskOverTimeData} for data model
 * - See {@link RiskOverTime} for domain model
 */
export class RiskOverTimeView implements View {
  timeframe: string = "";
  dataView: string = "";
  dataPoints: RiskOverTimeDataPointView[] = [];

  constructor(data?: RiskOverTime) {
    if (data == null) {
      return;
    }

    this.timeframe = data.timeframe;
    this.dataView = data.dataView;

    if (data.dataPoints != null) {
      this.dataPoints = data.dataPoints.map((dp) => new RiskOverTimeDataPointView(dp));
    }
  }

  toJSON() {
    return this;
  }

  static fromJSON(obj: Partial<Jsonify<RiskOverTimeView>>): RiskOverTimeView | undefined {
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
