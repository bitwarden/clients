import { BaseResponse } from "../../../models/response/base.response";

export class TwoFactorYubiKeyResponse extends BaseResponse {
  enabled: boolean;
  key1: string;
  key2: string;
  key3: string;
  key4: string;
  key5: string;
  nfc: boolean;

  constructor(response: any) {
    super(response);
    this.enabled = this.getResponseProperty("Enabled");
    this.key1 = this.getResponseProperty("Key1");
    this.key2 = this.getResponseProperty("Key2");
    this.key3 = this.getResponseProperty("Key3");
    this.key4 = this.getResponseProperty("Key4");
    this.key5 = this.getResponseProperty("Key5");
    this.nfc = this.getResponseProperty("Nfc");
  }
}
