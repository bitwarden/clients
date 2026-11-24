import { Jsonify } from "type-fest";

import { LoginUri as SdkLoginUri, EncString } from "@bitwarden/sdk-internal";

import {
  normalizeUriMatchStrategyForSdk,
  UriMatchStrategySetting,
} from "../../../models/domain/domain-service";
import Domain from "../../../platform/models/domain/domain-base";
import { LoginUriData } from "../data/login-uri.data";

export class LoginUri extends Domain {
  uri?: EncString;
  uriChecksum?: EncString;
  match?: UriMatchStrategySetting;

  constructor(obj?: LoginUriData) {
    super();
    if (obj == null) {
      return;
    }

    this.uri = (obj.uri ?? undefined) as EncString;
    this.uriChecksum = (obj.uriChecksum ?? undefined) as EncString;
    this.match = obj.match ?? undefined;
  }

  toLoginUriData(): LoginUriData {
    const u = new LoginUriData();
    this.buildDataModel(
      this,
      u,
      {
        uri: null,
        uriChecksum: null,
        match: null,
      },
      ["match"],
    );
    return u;
  }

  static fromJSON(obj: Jsonify<LoginUri> | undefined): LoginUri | undefined {
    if (obj == null) {
      return undefined;
    }

    const loginUri = new LoginUri();
    loginUri.uri = obj.uri ?? undefined;
    loginUri.match = obj.match ?? undefined;
    loginUri.uriChecksum = obj.uriChecksum ?? undefined;

    return loginUri;
  }

  /**
   *  Maps LoginUri to SDK format.
   *
   * @returns {SdkLoginUri} The SDK login uri object.
   */
  toSdkLoginUri(): SdkLoginUri {
    return {
      uri: this.uri ?? undefined,
      uriChecksum: this.uriChecksum ?? undefined,
      match: normalizeUriMatchStrategyForSdk(this.match),
    };
  }

  static fromSdkLoginUri(obj?: SdkLoginUri): LoginUri | undefined {
    if (obj == null) {
      return undefined;
    }

    const loginUri = new LoginUri();
    loginUri.uri = obj.uri ?? undefined;
    loginUri.uriChecksum = obj.uriChecksum ?? undefined;
    loginUri.match = obj.match;

    return loginUri;
  }
}
