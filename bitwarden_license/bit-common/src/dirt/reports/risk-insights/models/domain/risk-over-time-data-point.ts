import Domain from "@bitwarden/common/platform/models/domain/domain-base";

import { RiskOverTimeDataPointData } from "../data/risk-over-time-data-point.data";

/**
 * Domain model for a single data point in risk-over-time chart data.
 *
 * - See {@link RiskOverTimeDataPointApi} for API model
 * - See {@link RiskOverTimeDataPointData} for data model
 * - See {@link RiskOverTimeDataPointView} for view model
 */
export class RiskOverTimeDataPoint extends Domain {
  // TODO: If encryption is added (PM-28531), these plain types become EncString
  // and buildDomainModel()/decryptObj() from Domain base class should be used.
  // See concerns-and-gaps.md #4. [PM-28529]
  timestamp: string = "";
  atRisk: number = 0;
  total: number = 0;

  constructor(data?: RiskOverTimeDataPointData) {
    super();
    if (data == null) {
      return;
    }

    this.timestamp = data.timestamp;
    this.atRisk = data.atRisk;
    this.total = data.total;
  }

  toRiskOverTimeDataPointData(): RiskOverTimeDataPointData {
    const d = new RiskOverTimeDataPointData();
    d.timestamp = this.timestamp;
    d.atRisk = this.atRisk;
    d.total = this.total;
    return d;
  }
}
