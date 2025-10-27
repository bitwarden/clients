import { Jsonify } from "type-fest";

import { SshKey as SdkSshKey } from "@bitwarden/sdk-internal";
import { UserId } from "@bitwarden/user-core";

import { EncString } from "../../../key-management/crypto/models/enc-string";
import Domain from "../../../platform/models/domain/domain-base";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { SshKeyData } from "../data/ssh-key.data";
import { SshKeyView } from "../view/ssh-key.view";

export class SshKey extends Domain {
  privateKey!: EncString;
  publicKey!: EncString;
  keyFingerprint!: EncString;

  constructor(obj?: SshKeyData) {
    super();
    if (obj == null) {
      return;
    }

    this.privateKey = new EncString(obj.privateKey);
    this.publicKey = new EncString(obj.publicKey);
    this.keyFingerprint = new EncString(obj.keyFingerprint);
  }

  decrypt(
    userId: UserId,
    orgId: string | undefined,
    context = "No Cipher Context",
    encKey?: SymmetricCryptoKey,
  ): Promise<SshKeyView> {
    return this.decryptObj<SshKey, SshKeyView>(
      this,
      new SshKeyView(),
      ["privateKey", "publicKey", "keyFingerprint"],
      userId,
      orgId ?? null,
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

  static fromJSON(obj: Jsonify<SshKey> | undefined): SshKey | undefined {
    if (obj == null) {
      return undefined;
    }

    const sshKey = new SshKey();
    sshKey.privateKey = EncString.fromJSON(obj.privateKey);
    sshKey.publicKey = EncString.fromJSON(obj.publicKey);
    sshKey.keyFingerprint = EncString.fromJSON(obj.keyFingerprint);

    return sshKey;
  }

  /**
   * Maps SSH key to SDK format.
   *
   * @returns {SdkSshKey} The SDK SSH key object.
   */
  toSdkSshKey(): SdkSshKey {
    return {
      privateKey: this.privateKey.toSdk(),
      publicKey: this.publicKey.toSdk(),
      fingerprint: this.keyFingerprint.toSdk(),
    };
  }

  /**
   * Maps an SDK SshKey object to a SshKey
   * @param obj - The SDK SshKey object
   */
  static fromSdkSshKey(obj?: SdkSshKey): SshKey | undefined {
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
