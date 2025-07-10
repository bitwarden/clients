import { BaseResponse } from "../../../models/response/base.response";

import { CipherResponse } from "./cipher.response";

export class OptionalCipherResponse extends BaseResponse {
  unavailable: boolean;
  cipher?: CipherResponse;

  constructor(response: any) {
    super(response);
    this.unavailable = this.getResponseProperty("Unavailable");
    this.cipher = new CipherResponse(this.getResponseProperty("Cipher"));
  }
}
