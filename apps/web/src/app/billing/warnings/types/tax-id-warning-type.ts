import { BaseResponse } from "@bitwarden/common/models/response/base.response";

export const TaxIdWarningTypes = {
  Missing: "tax_id_missing",
  PendingVerification: "tax_id_pending_verification",
  FailedVerification: "tax_id_failed_verification",
} as const;

export type TaxIdWarningType = (typeof TaxIdWarningTypes)[keyof typeof TaxIdWarningTypes];

export class TaxIdWarningResponse extends BaseResponse {
  type: TaxIdWarningType;

  constructor(response: any) {
    super(response);

    this.type = this.getResponseProperty("Type");
  }
}
