import { BaseResponse } from "../../../models/response/base.response";
import { AlertDismissalId, CipherId } from "../../../types/guid";

export class AlertDismissalResponse extends BaseResponse {
  id: AlertDismissalId;
  cipherId: CipherId;
  dismissedAt: string;
  notes: string | null;

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.cipherId = this.getResponseProperty("CipherId");
    this.dismissedAt = this.getResponseProperty("DismissedAt");
    this.notes = this.getResponseProperty("Notes") ?? null;
  }
}
