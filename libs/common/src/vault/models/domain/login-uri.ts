import { Jsonify } from "type-fest";

// eslint-disable-next-line no-restricted-imports
import { EncString } from "@bitwarden/legacy-crypto";
import { LoginUri as SdkLoginUri } from "@bitwarden/sdk-internal";

import {
  normalizeUriMatchStrategyForSdk,
  UriMatchStrategySetting,
} from "../../../models/domain/domain-service";
import Domain from "../../../platform/models/domain/domain-base";
import { conditionalEncString, encStringFrom } from "../../utils/domain-utils";
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

    this.uri = conditionalEncString(obj.uri);
    this.uriChecksum = conditionalEncString(obj.uriChecksum);
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
    loginUri.uri = encStringFrom(obj.uri);
    loginUri.match = obj.match ?? undefined;
    loginUri.uriChecksum = encStringFrom(obj.uriChecksum);

    return loginUri;
  }

  /**
   *  Maps LoginUri to SDK format.
   *
   * @returns {SdkLoginUri} The SDK login uri object.
   */
  toSdkLoginUri(): SdkLoginUri {
    return {
      uri: this.uri?.toSdk(),
      uriChecksum: this.uriChecksum?.toSdk(),
      match: normalizeUriMatchStrategyForSdk(this.match),
    };
  }

  static fromSdkLoginUri(obj?: SdkLoginUri): LoginUri | undefined {
    if (obj == null) {
      return undefined;
    }

    const loginUri = new LoginUri();
    loginUri.uri = encStringFrom(obj.uri);
    loginUri.uriChecksum = encStringFrom(obj.uriChecksum);
    loginUri.match = obj.match;

    return loginUri;
  }
}
