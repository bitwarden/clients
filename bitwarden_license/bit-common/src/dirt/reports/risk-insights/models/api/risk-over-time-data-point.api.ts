import { BaseResponse } from "@bitwarden/common/models/response/base.response";

/**
 * API response model for a single data point in risk-over-time chart data.
 *
 * - See {@link RiskOverTimeDataPointData} for data model
 * - See {@link RiskOverTimeDataPoint} for domain model
 * - See {@link RiskOverTimeDataPointView} for view model
 */
export class RiskOverTimeDataPointApi extends BaseResponse {
  // TODO: If PM-28531 returns encrypted data, these become EncString fields
  // and decryption moves to the Domain layer. See concerns-and-gaps.md #4. [PM-28529]
  timestamp: string = "";
  atRisk: number = 0;
  total: number = 0;

  constructor(data: any = null) {
    super(data);
    if (data == null) {
      return;
    }

    // FIXME: Verify property names match server response casing when PM-28531 is implemented.
    // getResponseProperty() handles camelCase/PascalCase but NOT snake_case.
    // If server uses snake_case (e.g., "at_risk"), update these strings. [PM-28529]
    this.timestamp = this.getResponseProperty("timestamp");
    this.atRisk = this.getResponseProperty("atRisk");
    this.total = this.getResponseProperty("total");
  }
}
