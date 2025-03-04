// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Jsonify } from "type-fest";

import { EncryptService } from "../../key-management/crypto/abstractions/encrypt.service";
import { EncString } from "../../platform/models/domain/enc-string";
import { UserId } from "../../types/guid";
import { UserKey } from "../../types/key";
import { DataPacker } from "../state/data-packer.abstraction";

import { UserEncryptor } from "./user-encryptor.abstraction";

/** A classification strategy that protects a type's secrets by encrypting them
 *  with a `UserKey`
 */
export class UserKeyEncryptor extends UserEncryptor {
  /** Instantiates the encryptor
   *  @param userId identifies the user bound to the encryptor.
   *  @param encryptService protects properties of `Secret`.
   *  @param keyService looks up the user key when protecting data.
   *  @param dataPacker packs and unpacks data classified as secrets.
   */
  constructor(
    readonly userId: UserId,
    private readonly encryptService: EncryptService,
    private readonly key: UserKey,
    private readonly dataPacker: DataPacker,
  ) {
    super();
    this.assertHasValue("userId", userId);
    this.assertHasValue("key", key);
    this.assertHasValue("dataPacker", dataPacker);
    this.assertHasValue("encryptService", encryptService);
  }

  async encrypt<Secret>(secret: Jsonify<Secret>): Promise<EncString> {
    this.assertHasValue("secret", secret);

    let packed = this.dataPacker.pack(secret);
    const encrypted = await this.encryptService.encrypt(packed, this.key);
    packed = null;

    return encrypted;
  }

  async decrypt<Secret>(secret: EncString): Promise<Jsonify<Secret>> {
    this.assertHasValue("secret", secret);

    let decrypted = await this.encryptService.decryptToUtf8(secret, this.key);
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
