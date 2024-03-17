import { Jsonify } from "type-fest";

import { CryptoService } from "../../../platform/abstractions/crypto.service";
import { EncryptService } from "../../../platform/abstractions/encrypt.service";
import { EncString } from "../../../platform/models/domain/enc-string";
import { UserId } from "../../../types/guid";

import { DataPacker } from "./data-packer.abstraction";
import { SecretClassifier } from "./secret-classifier";
import { UserEncryptor } from "./user-encryptor.abstraction";

/** A classification strategy that protects a type's secrets by encrypting them
 *  with a `UserKey`
 */
export class UserKeyEncryptor<State extends object, Disclosed, Secret> extends UserEncryptor<
  State,
  Disclosed
> {
  /** Instantiates the encryptor
   *  @param encryptService protects properties of `Secret`.
   *  @param keyService looks up the user key when protecting data.
   *  @param classifier partitions secrets and disclosed information.
   *  @param dataPacker packs and unpacks data classified as secrets.
   */
  constructor(
    private readonly encryptService: EncryptService,
    private readonly keyService: CryptoService,
    private readonly classifier: SecretClassifier<State, Disclosed, Secret>,
    private readonly dataPacker: DataPacker,
  ) {
    super();
  }

  /** {@link UserEncryptor.encrypt} */
  async encrypt(
    value: State,
    userId: UserId,
  ): Promise<{ secret: EncString; disclosed: Disclosed }> {
    this.assertHasValue("value", value);
    this.assertHasValue("userId", userId);

    const classified = this.classifier.classify(value);
    let packed = this.dataPacker.pack(classified.secret);

    // encrypt the data and drop the key
    let key = await this.keyService.getUserKey(userId);
    const secret = await this.encryptService.encrypt(packed, key);
    packed = null;
    key = null;

    return { ...classified, secret };
  }

  /** {@link UserEncryptor.decrypt} */
  async decrypt(
    secret: EncString,
    disclosed: Jsonify<Disclosed>,
    userId: UserId,
  ): Promise<Jsonify<State>> {
    this.assertHasValue("secret", secret);
    this.assertHasValue("disclosed", disclosed);
    this.assertHasValue("userId", userId);

    // decrypt the data and drop the key
    let key = await this.keyService.getUserKey(userId);
    let decrypted = await this.encryptService.decryptToUtf8(secret, key);
    key = null;

    // reconstruct TFrom's data
    const unpacked = this.dataPacker.unpack<Secret>(decrypted);
    decrypted = null;

    const jsonValue = this.classifier.declassify(disclosed, unpacked);

    return jsonValue;
  }

  private assertHasValue(name: string, value: any) {
    if (value === undefined || value === null) {
      throw new Error(`${name} cannot be null or undefined`);
    }
  }
}
