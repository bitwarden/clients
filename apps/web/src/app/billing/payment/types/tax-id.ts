import { BaseResponse } from "@bitwarden/common/models/response/base.response";

export interface TaxId {
  code: string;
  value: string;
}

export class TaxIdResponse extends BaseResponse implements TaxId {
  code: string;
  value: string;

  constructor(response: any) {
    super(response);

    this.code = this.getResponseProperty("Code");
    this.value = this.getResponseProperty("Value");
  }
}
