import { Jsonify } from "type-fest";

import { SshKey as SdkSshKey, EncString } from "@bitwarden/sdk-internal";

import Domain from "../../../platform/models/domain/domain-base";
import { SshKeyData } from "../data/ssh-key.data";

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

    this.privateKey = obj.privateKey as EncString;
    this.publicKey = obj.publicKey != null ? (obj.publicKey as EncString) : undefined;
    this.keyFingerprint =
      obj.keyFingerprint != null ? (obj.keyFingerprint as EncString) : undefined;
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
    sshKey.privateKey = obj.privateKey;
    sshKey.publicKey = obj.publicKey != null ? obj.publicKey : undefined;
    sshKey.keyFingerprint = obj.keyFingerprint != null ? obj.keyFingerprint : undefined;

    return sshKey;
  }

  /**
   * Maps SSH key to SDK format.
   *
   * @returns {SdkSshKey} The SDK SSH key object.
   */
  toSdkSshKey(): SdkSshKey {
    return {
      privateKey: this.privateKey,
      publicKey: this.publicKey ?? undefined,
      fingerprint: this.keyFingerprint ?? undefined,
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
    sshKey.privateKey = obj.privateKey;
    sshKey.publicKey = obj.publicKey != null ? obj.publicKey : undefined;
    sshKey.keyFingerprint = obj.fingerprint != null ? obj.fingerprint : undefined;

    return sshKey;
  }
}
