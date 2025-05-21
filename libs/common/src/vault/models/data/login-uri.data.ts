// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { UriMatchStrategySetting } from "../../../models/domain/domain-service";
import { LoginUriApi } from "../api/login-uri.api";

export class LoginUriData {
  uri: string;
  uriChecksum: string;
  match: UriMatchStrategySetting = null;

  constructor(data?: LoginUriApi) {
    if (data == null) {
      return;
    }
    this.uri = data.uri;
    this.uriChecksum = data.uriChecksum;
    this.match = data.match;
  }
}
