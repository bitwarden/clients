import { BaseResponse } from "../../../../models/response/base.response";

export interface IKeyConnectorUserDecryptionOptionServerResponse {
  KeyConnectorUrl: string;
}

export class KeyConnectorUserDecryptionOptionResponse extends BaseResponse {
  keyConnectorUrl: string;

  constructor(response: IKeyConnectorUserDecryptionOptionServerResponse) {
    super(response);
    this.keyConnectorUrl = this.getResponseProperty("KeyConnectorUrl");
  }
}
