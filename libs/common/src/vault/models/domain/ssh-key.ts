// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Jsonify } from "type-fest";

import { SshKey as SdkSshKey } from "@bitwarden/sdk-internal";

import { EncString } from "../../../key-management/crypto/models/enc-string";
import Domain from "../../../platform/models/domain/domain-base";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { SshKeyData } from "../data/ssh-key.data";
import { SshKeyView } from "../view/ssh-key.view";

export class SshKey extends Domain {
  privateKey: EncString;
  publicKey: EncString;
  keyFingerprint: EncString;

  constructor(obj?: SshKeyData) {
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
        keyFingerprint: null,
      },
      [],
    );
  }

  decrypt(
    orgId: string,
    context = "No Cipher Context",
    encKey?: SymmetricCryptoKey,
  ): Promise<SshKeyView> {
    return this.decryptObj<SshKey, SshKeyView>(
      this,
      new SshKeyView(),
      ["privateKey", "publicKey", "keyFingerprint"],
      orgId,
      encKey,
      "DomainType: SshKey; " + context,
    );
  }

  toSshKeyData(): SshKeyData {
    const c = new SshKeyData();
    this.buildDataModel(this, c, {
      privateKey: null,
      publicKey: null,
      keyFingerprint: null,
    });
    return c;
  }

  static fromJSON(obj: Partial<Jsonify<SshKey>>): SshKey {
    if (obj == null) {
      return null;
    }

    const privateKey = EncString.fromJSON(obj.privateKey);
    const publicKey = EncString.fromJSON(obj.publicKey);
    const keyFingerprint = EncString.fromJSON(obj.keyFingerprint);
    return Object.assign(new SshKey(), obj, {
      privateKey,
      publicKey,
      keyFingerprint,
    });
  }

  /**
   * Maps SSH key to SDK format.
   *
   * @returns {SdkSshKey} The SDK SSH key object.
   */
  toSdkSshKey(): SdkSshKey {
    return {
      privateKey: this.privateKey.toJSON(),
      publicKey: this.publicKey.toJSON(),
      fingerprint: this.keyFingerprint.toJSON(),
    };
  }

  /**
   * Maps an SDK SshKey object to a SshKey
   * @param obj - The SDK SshKey object
   */
  static fromSdkSshKey(obj: SdkSshKey): SshKey | undefined {
    if (obj == null) {
      return undefined;
    }

    const sshKey = new SshKey();
    sshKey.privateKey = EncString.fromJSON(obj.privateKey);
    sshKey.publicKey = EncString.fromJSON(obj.publicKey);
    sshKey.keyFingerprint = EncString.fromJSON(obj.fingerprint);

    return sshKey;
  }
}
