import { Jsonify } from "type-fest";

import { SshKey as SdkSshKey } from "@bitwarden/sdk-internal";

import { EncString } from "../../../key-management/crypto/models/enc-string";
import Domain from "../../../platform/models/domain/domain-base";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { SshKeyData } from "../data/ssh-key.data";
import { SshKeyView } from "../view/ssh-key.view";

export class SshKey extends Domain {
  privateKey!: EncString;
  /** Derivable from the private key, so may be absent at rest. */
  publicKey?: EncString;
  /** Derivable from the private key, so may be absent at rest. */
  keyFingerprint?: EncString;

  constructor(obj?: SshKeyData) {
    super();
    if (obj == null) {
      return;
    }

    this.privateKey = new EncString(obj.privateKey);
    this.publicKey = obj.publicKey != null ? new EncString(obj.publicKey) : undefined;
    this.keyFingerprint =
      obj.keyFingerprint != null ? new EncString(obj.keyFingerprint) : undefined;
  }

  decrypt(encKey: SymmetricCryptoKey, context = "No Cipher Context"): Promise<SshKeyView> {
    return this.decryptObj<SshKey, SshKeyView>(
      this,
      new SshKeyView(),
      ["privateKey", "publicKey", "keyFingerprint"],
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
    sshKey.publicKey = obj.publicKey != null ? EncString.fromJSON(obj.publicKey) : undefined;
    sshKey.keyFingerprint =
      obj.keyFingerprint != null ? EncString.fromJSON(obj.keyFingerprint) : undefined;

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
      publicKey: this.publicKey?.toSdk(),
      fingerprint: this.keyFingerprint?.toSdk(),
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
    sshKey.publicKey = obj.publicKey != null ? EncString.fromJSON(obj.publicKey) : undefined;
    sshKey.keyFingerprint =
      obj.fingerprint != null ? EncString.fromJSON(obj.fingerprint) : undefined;

    return sshKey;
  }
}
