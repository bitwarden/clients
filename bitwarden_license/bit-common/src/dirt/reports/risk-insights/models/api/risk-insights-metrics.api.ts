import { BaseResponse } from "@bitwarden/common/models/response/base.response";

export class RiskInsightsMetricsApi extends BaseResponse {
  totalApplicationCount: number = 0;
  totalAtRiskApplicationCount: number = 0;
  totalCriticalApplicationCount: number = 0;
  totalCriticalAtRiskApplicationCount: number = 0;
  totalMemberCount: number = 0;
  totalAtRiskMemberCount: number = 0;
  totalCriticalMemberCount: number = 0;
  totalCriticalAtRiskMemberCount: number = 0;
  totalPasswordCount: number = 0;
  totalAtRiskPasswordCount: number = 0;
  totalCriticalPasswordCount: number = 0;
  totalCriticalAtRiskPasswordCount: number = 0;

  constructor(data: any) {
    super(data);
    if (data == null) {
      return;
    }

    this.totalApplicationCount = this.getResponseProperty("totalApplicationCount");
    this.totalAtRiskApplicationCount = this.getResponseProperty("totalAtRiskApplicationCount");
    this.totalCriticalApplicationCount = this.getResponseProperty("totalCriticalApplicationCount");
    this.totalCriticalAtRiskApplicationCount = this.getResponseProperty(
      "totalCriticalAtRiskApplicationCount",
    );
    this.totalMemberCount = this.getResponseProperty("totalMemberCount");
    this.totalAtRiskMemberCount = this.getResponseProperty("totalAtRiskMemberCount");
    this.totalCriticalMemberCount = this.getResponseProperty("totalCriticalMemberCount");
    this.totalCriticalAtRiskMemberCount = this.getResponseProperty(
      "totalCriticalAtRiskMemberCount",
    );
    this.totalPasswordCount = this.getResponseProperty("totalPasswordCount");
    this.totalAtRiskPasswordCount = this.getResponseProperty("totalAtRiskPasswordCount");
    this.totalCriticalPasswordCount = this.getResponseProperty("totalCriticalPasswordCount");
    this.totalCriticalAtRiskPasswordCount = this.getResponseProperty(
      "totalCriticalAtRiskPasswordCount",
    );
  }
}
