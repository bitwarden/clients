import { BaseResponse } from "@bitwarden/common/models/response/base.response";

export class AccessReportMetricsApi extends BaseResponse {
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

    this.totalApplicationCount = this.getResponseProperty("totalApplicationCount") ?? 0;
    this.totalAtRiskApplicationCount = this.getResponseProperty("totalAtRiskApplicationCount") ?? 0;
    this.totalCriticalApplicationCount =
      this.getResponseProperty("totalCriticalApplicationCount") ?? 0;
    this.totalCriticalAtRiskApplicationCount =
      this.getResponseProperty("totalCriticalAtRiskApplicationCount") ?? 0;
    this.totalMemberCount = this.getResponseProperty("totalMemberCount") ?? 0;
    this.totalAtRiskMemberCount = this.getResponseProperty("totalAtRiskMemberCount") ?? 0;
    this.totalCriticalMemberCount = this.getResponseProperty("totalCriticalMemberCount") ?? 0;
    this.totalCriticalAtRiskMemberCount =
      this.getResponseProperty("totalCriticalAtRiskMemberCount") ?? 0;
    this.totalPasswordCount = this.getResponseProperty("totalPasswordCount") ?? 0;
    this.totalAtRiskPasswordCount = this.getResponseProperty("totalAtRiskPasswordCount") ?? 0;
    this.totalCriticalPasswordCount = this.getResponseProperty("totalCriticalPasswordCount") ?? 0;
    this.totalCriticalAtRiskPasswordCount =
      this.getResponseProperty("totalCriticalAtRiskPasswordCount") ?? 0;
  }
}
