import { BaseResponse } from "@bitwarden/common/models/response/base.response";

export type AgentFillApprovalStatus = "pending" | "answered" | "expired";

/** The server's record of one approval request. Both sealed fields are opaque to the server. */
export class AgentFillApprovalRecord extends BaseResponse {
  id: string;
  requestDeviceId: string;
  sealedRequest: string;
  sealedResponse: string | null;
  responseDeviceId: string | null;
  creationDate: string;
  expirationDate: string;
  responseDate: string | null;
  status: AgentFillApprovalStatus;

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.requestDeviceId = this.getResponseProperty("RequestDeviceId");
    this.sealedRequest = this.getResponseProperty("SealedRequest");
    this.sealedResponse = this.getResponseProperty("SealedResponse") ?? null;
    this.responseDeviceId = this.getResponseProperty("ResponseDeviceId") ?? null;
    this.creationDate = this.getResponseProperty("CreationDate");
    this.expirationDate = this.getResponseProperty("ExpirationDate");
    this.responseDate = this.getResponseProperty("ResponseDate") ?? null;
    this.status = this.getResponseProperty("Status");
  }
}
