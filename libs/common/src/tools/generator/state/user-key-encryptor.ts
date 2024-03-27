import { Jsonify } from "type-fest";

import { CryptoService } from "../../../platform/abstractions/crypto.service";
import { EncryptService } from "../../../platform/abstractions/encrypt.service";
import { EncString } from "../../../platform/models/domain/enc-string";
import { UserId } from "../../../types/guid";

import { DataPacker } from "./data-packer.abstraction";
import { UserEncryptor } from "./user-encryptor.abstraction";

/** A classification strategy that protects a type's secrets by encrypting them
 *  with a `UserKey`
 */
export class UserKeyEncryptor<Secret> extends UserEncryptor<Secret> {
  /** Instantiates the encryptor
   *  @param encryptService protects properties of `Secret`.
   *  @param keyService looks up the user key when protecting data.
   *  @param dataPacker packs and unpacks data classified as secrets.
   */
  constructor(
    private readonly encryptService: EncryptService,
    private readonly keyService: CryptoService,
    private readonly dataPacker: DataPacker,
  ) {
    super();
  }

  /** {@link UserEncryptor.encrypt} */
  async encrypt(secret: Secret, userId: UserId): Promise<EncString> {
    this.assertHasValue("secret", secret);
    this.assertHasValue("userId", userId);

    let packed = this.dataPacker.pack(secret);

    // encrypt the data and drop the key
    let key = await this.keyService.getUserKey(userId);
    const encrypted = await this.encryptService.encrypt(packed, key);
    packed = null;
    key = null;

    return encrypted;
  }

  /** {@link UserEncryptor.decrypt} */
  async decrypt(secret: EncString, userId: UserId): Promise<Jsonify<Secret>> {
    this.assertHasValue("secret", secret);
    this.assertHasValue("userId", userId);

    // decrypt the data and drop the key
    let key = await this.keyService.getUserKey(userId);
    let decrypted = await this.encryptService.decryptToUtf8(secret, key);
    key = null;

    // reconstruct TFrom's data
    const unpacked = this.dataPacker.unpack<Secret>(decrypted);
    decrypted = null;

    return unpacked;
  }

  private assertHasValue(name: string, value: any) {
    if (value === undefined || value === null) {
      throw new Error(`${name} cannot be null or undefined`);
    }
  }
}
