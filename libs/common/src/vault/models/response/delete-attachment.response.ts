import { BaseResponse } from "../../../models/response/base.response";

import { CipherResponse } from "./cipher.response";

export class DeleteAttachmentResponse extends BaseResponse {
  cipher: CipherResponse;

  constructor(response: any) {
    super(response);
    this.cipher = new CipherResponse(this.getResponseProperty("Cipher"));
  }
}
