import { Jsonify } from "type-fest";

import { CryptoService } from "../../../platform/abstractions/crypto.service";
import { EncryptService } from "../../../platform/abstractions/encrypt.service";
import { EncString } from "../../../platform/models/domain/enc-string";
import { UserId } from "../../../types/guid";

import { SecretClassifier } from "./secret-classifier";
import { UserKeyEncryptorOptions } from "./user-key-encryptor-options";

const SecretPadding = Object.freeze({
  frameSize: 512,

  /** The character to use for padding. */
  character: "0",

  /** A regular expression for detecting invalid padding. When the character
   *  changes, this should be updated to include the new padding pattern.
   */
  hasInvalidPadding: /[^0]/,
});

/** A classification strategy that protects a type's secrets by encrypting them
 *  with a `UserKey`
 */
export class UserKeyEncryptor<State extends object, Disclosed, Secret> {
  /** Instantiates the encryptor
   *  @param encryptService protects properties of `Secret`.
   *  @param keyService looks up the user key when protecting data.
   *  @param classifier partitions secrets and disclosed information.
   *  @param options configures encryption and decryption operations
   */
  constructor(
    private readonly encryptService: EncryptService,
    private readonly keyService: CryptoService,
    private readonly classifier: SecretClassifier<State, Disclosed, Secret>,
    private readonly options: UserKeyEncryptorOptions = SecretPadding,
  ) {}

  /** Protects secrets in `value` using the user's key.
   *  @param value the object to protect. This object is mutated during encryption.
   *  @returns a promise that resolves to a tuple. The tuple's first property contains
   *    the encrypted secret and whose second property contains an object w/ disclosed
   *    properties.
   *   @throws If `value` is `null` or `undefined`, the promise rejects with an error.
   */
  async encrypt(value: State, userId: UserId): Promise<[EncString, Disclosed]> {
    if (value === undefined || value === null) {
      throw new Error("value cannot be null or undefined");
    }
    if (userId === undefined || userId === null) {
      throw new Error("userId cannot be null or undefined");
    }

    const classifiedValue = this.classifier.classify(value);
    const encryptedValue = await this.encryptSecret(classifiedValue.secret, userId);
    return [encryptedValue, classifiedValue.disclosed] as const;
  }

  /** Combines protected secrets and disclosed data into a type that can be
   *  rehydrated into a domain object.
   *  @param secret the object to protect. This object is mutated during encryption.
   *  @returns a promise that resolves to the jsonified state. This state *is not* a
   *    class. It must be rehydrated first.
   *  @throws If `secret` or `disclosed` is `null` or `undefined`, the promise
   *    rejects with an error.
   */
  async decrypt(secret: EncString, disclosed: Disclosed, userId: UserId): Promise<Jsonify<State>> {
    if (secret === undefined || secret === null) {
      throw new Error("secret cannot be null or undefined");
    }
    if (disclosed === undefined || disclosed === null) {
      throw new Error("disclosed cannot be null or undefined");
    }
    if (userId === undefined || userId === null) {
      throw new Error("userId cannot be null or undefined");
    }

    // reconstruct TFrom's data
    const decrypted = await this.decryptSecret(secret, userId);
    const jsonValue = this.classifier.declassify(disclosed, decrypted);

    return jsonValue;
  }

  private async encryptSecret(value: Secret, userId: UserId) {
    // package the data for encryption
    let json = JSON.stringify(value);

    // conceal the length of the encrypted data
    const frameSize = JSON.stringify(this.options.frameSize);
    const payloadLength = json.length + frameSize.length;
    const paddingLength = this.options.frameSize - (payloadLength % this.options.frameSize);
    const padding = SecretPadding.character.repeat(paddingLength);
    let toEncrypt = `${frameSize}${json}${padding}`;
    json = null;

    // encrypt the data and drop the key
    let key = await this.keyService.getUserKey(userId);
    const encrypted = await this.encryptService.encrypt(toEncrypt, key);
    toEncrypt = null;
    key = null;

    return encrypted;
  }

  private async decryptSecret(value: EncString, userId: UserId): Promise<Secret> {
    // decrypt the data and drop the key
    let key = await this.keyService.getUserKey(userId);
    const decrypted = await this.encryptService.decryptToUtf8(value, key);
    key = null;

    // frame size is stored before the JSON payload in base 10
    const frameBreakpoint = decrypted.indexOf("{");
    if (frameBreakpoint < 1) {
      throw new Error("missing frame size");
    }
    const frameSize = parseInt(decrypted.slice(0, frameBreakpoint), 10);

    // The decrypted string should be a multiple of the frame length
    if (decrypted.length % frameSize > 0) {
      throw new Error("invalid length");
    }

    // JSON terminates with a closing brace, followed by the padding character
    const jsonBreakpoint = decrypted.lastIndexOf("}") + 1;
    if (jsonBreakpoint < 1) {
      throw new Error("missing json object");
    }

    // If the padding contains invalid padding characters then the padding could be used
    // as a side channel for arbitrary data.
    if (decrypted.slice(jsonBreakpoint).match(SecretPadding.hasInvalidPadding)) {
      throw new Error("invalid padding");
    }

    // remove frame size and padding
    const unpacked = decrypted.substring(frameBreakpoint, jsonBreakpoint);
    const parsed = JSON.parse(unpacked);

    return parsed;
  }
}
