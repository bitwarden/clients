// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Jsonify } from "type-fest";

import { UriMatchStrategySetting } from "../../../models/domain/domain-service";
import { Utils } from "../../../platform/misc/utils";
import Domain from "../../../platform/models/domain/domain-base";
import { EncString } from "../../../platform/models/domain/enc-string";
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
    return this.decryptObj(
      new LoginUriView(this),
      {
        uri: null,
      },
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
}
