// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { firstValueFrom, map } from "rxjs";
import { Jsonify } from "type-fest";

import { OrganizationId } from "@bitwarden/common/types/guid";
import { LoginUri as SdkLoginUri } from "@bitwarden/sdk-internal";
import { UserId } from "@bitwarden/user-core";

import { EncString } from "../../../key-management/crypto/models/enc-string";
import { UriMatchStrategySetting } from "../../../models/domain/domain-service";
import { Utils } from "../../../platform/misc/utils";
import Domain from "../../../platform/models/domain/domain-base";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { conditionalEncString, encStringFrom } from "../../utils/domain-utils";
import { LoginUriData } from "../data/login-uri.data";
import { LoginUriView } from "../view/login-uri.view";

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

  decrypt(
    userId: UserId,
    orgId: string | undefined,
    context: string = "No Cipher Context",
    encKey?: SymmetricCryptoKey,
  ): Promise<LoginUriView> {
    return this.decryptObj<LoginUri, LoginUriView>(
      this,
      new LoginUriView(this),
      ["uri"],
      userId,
      orgId ?? null,
      encKey,
      context,
    );
  }

  async validateChecksum(
    clearTextUri: string,
    userId: UserId,
    orgId?: string,
    key?: SymmetricCryptoKey,
  ) {
    if (this.uriChecksum == null) {
      return false;
    }

    const keyService = Utils.getContainerService().getKeyService();
    const encService = Utils.getContainerService().getEncryptService();
    const localChecksum = await encService.hash(clearTextUri, "sha256");

    if (key == null) {
      if (orgId != null) {
        key = await firstValueFrom(
          keyService
            .orgKeys$(userId)
            .pipe(map((orgKeys) => orgKeys[orgId as OrganizationId] ?? null)),
        );
      } else {
        key = await firstValueFrom(keyService.userKey$(userId));
      }
    }
    const remoteChecksum = await encService.decryptString(this.uriChecksum, key);

    /// WARNING: This is not constant time. This should be moved to the SDK
    return remoteChecksum === localChecksum;
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
      match: this.match,
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
