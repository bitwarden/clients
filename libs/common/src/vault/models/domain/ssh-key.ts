import { Jsonify } from "type-fest";

import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";

import Domain from "../../../platform/models/domain/domain-base";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { SSHKeyData } from "../data/ssh-key.data";
import { SSHKeyView } from "../view/ssh-key.view";

export class SSHKey extends Domain {
  privateKey: EncString;
  publicKey: EncString;
  keyAlgorithm: EncString;
  keyFingerprint: EncString;

  constructor(obj?: SSHKeyData) {
    super();
    if (obj == null) {
      return;
    }

    this.buildDomainModel(
      this,
      obj,
      {
        privateKey: null,
        publicKey: null,
        keyAlgorithm: null,
        keyFingerprint: null,
      },
      [],
    );
  }

  decrypt(orgId: string, encKey?: SymmetricCryptoKey): Promise<SSHKeyView> {
    return this.decryptObj(
      new SSHKeyView(),
      {
        privateKey: null,
        publicKey: null,
        keyAlgorithm: null,
        keyFingerprint: null,
      },
      orgId,
      encKey,
    );
  }

  toSSHKeyData(): SSHKeyData {
    const c = new SSHKeyData();
    this.buildDataModel(this, c, {
      privateKey: null,
      publicKey: null,
      keyAlgorithm: null,
      keyFingerprint: null,
    });
    return c;
  }

  static fromJSON(obj: Partial<Jsonify<SSHKey>>): SSHKey {
    if (obj == null) {
      return null;
    }

    const privateKey = EncString.fromJSON(obj.privateKey);
    const publicKey = EncString.fromJSON(obj.publicKey);
    const keyAlgorithm = EncString.fromJSON(obj.keyAlgorithm);
    const keyFingerprint = EncString.fromJSON(obj.keyFingerprint);
    return Object.assign(new SSHKey(), obj, {
      privateKey,
      publicKey,
      keyAlgorithm,
      keyFingerprint,
    });
  }
}
