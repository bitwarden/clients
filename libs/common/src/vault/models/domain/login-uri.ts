// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Jsonify } from "type-fest";

import { LoginUri as SdkLoginUri } from "@bitwarden/sdk-internal";

import { EncString } from "../../../key-management/crypto/models/enc-string";
import { UriMatchStrategySetting } from "../../../models/domain/domain-service";
import { Utils } from "../../../platform/misc/utils";
import Domain from "../../../platform/models/domain/domain-base";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { LoginUriData } from "../data/login-uri.data";
import { LoginUriView } from "../view/login-uri.view";

export class LoginUri extends Domain {
  uri: EncString;
  uriChecksum: EncString | undefined;
  match: UriMatchStrategySetting;

  constructor(obj?: LoginUriData) {
    super();
    if (obj == null) {
      return;
    }

    this.match = obj.match;
    this.buildDomainModel(
      this,
      obj,
      {
        uri: null,
        uriChecksum: null,
      },
      [],
    );
  }

  decrypt(
    orgId: string,
    context: string = "No Cipher Context",
    encKey?: SymmetricCryptoKey,
  ): Promise<LoginUriView> {
    return this.decryptObj<LoginUri, LoginUriView>(
      this,
      new LoginUriView(this),
      ["uri"],
      orgId,
      encKey,
      context,
    );
  }

  async validateChecksum(clearTextUri: string, orgId: string, encKey: SymmetricCryptoKey) {
    if (this.uriChecksum == null) {
      return false;
    }

    const keyService = Utils.getContainerService().getEncryptService();
    const localChecksum = await keyService.hash(clearTextUri, "sha256");

    const remoteChecksum = await this.uriChecksum.decrypt(orgId, encKey);
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

  static fromJSON(obj: Jsonify<LoginUri>): LoginUri {
    if (obj == null) {
      return null;
    }

    const uri = EncString.fromJSON(obj.uri);
    const uriChecksum = EncString.fromJSON(obj.uriChecksum);
    return Object.assign(new LoginUri(), obj, {
      uri,
      uriChecksum,
    });
  }

  /**
   *  Maps LoginUri to SDK format.
   *
   * @returns {SdkLoginUri} The SDK login uri object.
   */
  toSdkLoginUri(): SdkLoginUri {
    return {
      uri: this.uri?.toJSON(),
      uriChecksum: this.uriChecksum?.toJSON(),
      match: this.match,
    };
  }

  static fromSdkLoginUri(obj: SdkLoginUri): LoginUri | undefined {
    if (obj == null) {
      return undefined;
    }

    const view = new LoginUri();
    view.uri = EncString.fromJSON(obj.uri);
    view.uriChecksum = obj.uriChecksum ? EncString.fromJSON(obj.uriChecksum) : undefined;
    view.match = obj.match;

    return view;
  }
}
