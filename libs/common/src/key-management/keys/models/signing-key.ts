import { EncString } from "@bitwarden/sdk-internal";

/**
 * Represents a signing key.
 * Internally, this is encrypted and needs an unlocked SDK instance for the correct user
 * to use.
 */
export class SigningKey {
  private innerKey: EncString;

  constructor(innerKey: string) {
    this.innerKey = innerKey;
  }

  /**
   * Gets the encrypted signing key as an EncString, encrypted
   * by another symmetric key like the user key for the user.
   * @returns The encrypted signing key as an EncString
   */
  inner(): EncString {
    return this.innerKey;
  }

  /**
   * Gets a JSON serializable version of the signing key.
   */
  toSerializable(): SerializableUserSigningKeyPair {
    return new SerializableUserSigningKeyPair(this.innerKey);
  }

  /**
   * Creates a serializable version of the signing key.
   */
  static fromSerializable(serializable: SerializableUserSigningKeyPair): SigningKey {
    return new SigningKey(serializable.signingKey);
  }
}

/**
 * This class is a clear, explicit conversion, leaking the details
 * of the signing key, in order to be serializable with JSON typefest.
 * This is used to store the signing key to local state.
 */
export class SerializableUserSigningKeyPair {
  constructor(readonly signingKey: EncString) {}

  static fromJson(obj: any): SerializableUserSigningKeyPair | null {
    if (obj == null) {
      return null;
    }

    return new SerializableUserSigningKeyPair(obj.signingKey);
  }
}
