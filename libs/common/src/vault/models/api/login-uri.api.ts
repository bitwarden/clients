// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { UriMatchStrategySetting } from "../../../models/domain/domain-service";
import { BaseResponse } from "../../../models/response/base.response";

export class LoginUriApi extends BaseResponse {
  uri: string;
  uriChecksum: string;
  match: UriMatchStrategySetting = null;

  constructor(data: any = null) {
    super(data);
    if (data == null) {
      return;
    }
    this.uri = this.getResponseProperty("Uri");
    this.uriChecksum = this.getResponseProperty("UriChecksum");
    const match = this.getResponseProperty("Match");
    this.match = match != null ? match : null;
  }
}
