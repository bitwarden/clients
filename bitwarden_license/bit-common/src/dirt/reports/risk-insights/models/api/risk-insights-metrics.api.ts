import { BaseResponse } from "@bitwarden/common/models/response/base.response";

export class RiskInsightsMetricsApi extends BaseResponse {
  totalApplicationCount: number;
  totalAtRiskApplicationCount: number;
  totalCriticalApplicationCount: number;
  totalCriticalAtRiskApplicationCount: number;
  totalMemberCount: number;
  totalAtRiskMemberCount: number;
  totalCriticalMemberCount: number;
  totalCriticalAtRiskMemberCount: number;
  totalPasswordCount: number;
  totalAtRiskPasswordCount: number;
  totalCriticalPasswordCount: number;
  totalCriticalAtRiskPasswordCount: number;

  constructor(data: any) {
    super(data);
    if (data == null) {
      return;
    }

    this.totalApplicationCount = this.getResponseProperty("totalApplicationCount") || 0;
    this.totalAtRiskApplicationCount = this.getResponseProperty("totalAtRiskApplicationCount") || 0;
    this.totalCriticalApplicationCount =
      this.getResponseProperty("totalCriticalApplicationCount") || 0;
    this.totalCriticalAtRiskApplicationCount =
      this.getResponseProperty("totalCriticalAtRiskApplicationCount") || 0;
    this.totalMemberCount = this.getResponseProperty("totalMemberCount") || 0;
    this.totalAtRiskMemberCount = this.getResponseProperty("totalAtRiskMemberCount") || 0;
    this.totalCriticalMemberCount = this.getResponseProperty("totalCriticalMemberCount") || 0;
    this.totalCriticalAtRiskMemberCount =
      this.getResponseProperty("totalCriticalAtRiskMemberCount") || 0;
    this.totalPasswordCount = this.getResponseProperty("totalPasswordCount") || 0;
    this.totalAtRiskPasswordCount = this.getResponseProperty("totalAtRiskPasswordCount") || 0;
    this.totalCriticalPasswordCount = this.getResponseProperty("totalCriticalPasswordCount") || 0;
    this.totalCriticalAtRiskPasswordCount =
      this.getResponseProperty("totalCriticalAtRiskPasswordCount") || 0;
  }
}
