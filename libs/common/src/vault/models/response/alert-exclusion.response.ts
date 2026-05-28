import { BaseResponse } from "../../../models/response/base.response";
import { AlertExclusionId, CipherId } from "../../../types/guid";

export class AlertExclusionResponse extends BaseResponse {
  id: AlertExclusionId;
  cipherId: CipherId;
  excludedAt: string;
  notes: string | null;
  riskTypes: number;

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.cipherId = this.getResponseProperty("CipherId");
    // Wire format: server JSON property is "DismissedAt" (legacy server contract).
    this.excludedAt = this.getResponseProperty("DismissedAt");
    this.notes = this.getResponseProperty("Notes") ?? null;
    this.riskTypes = this.getResponseProperty("RiskTypes") ?? 0;
  }
}
