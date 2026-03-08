// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { firstValueFrom, map } from "rxjs";
import { Jsonify } from "type-fest";

import { EncString } from "../../key-management/crypto/models/enc-string";
import { SdkService } from "../../platform/abstractions/sdk/sdk.service";
import { UserId } from "../../types/guid";
import { DataPacker } from "../state/data-packer.abstraction";

import { UserEncryptor } from "./user-encryptor.abstraction";

/** A classification strategy that protects a type's secrets by encrypting them
 *  with the SDK's local user data key
 */
export class UserKeyEncryptor extends UserEncryptor {
  /** Instantiates the encryptor
   *  @param userId identifies the user bound to the encryptor.
   *  @param sdkService provides SDK crypto access for local user data key encryption.
   *  @param dataPacker packs and unpacks data classified as secrets.
   */
  constructor(
    readonly userId: UserId,
    private readonly sdkService: SdkService,
    private readonly dataPacker: DataPacker,
  ) {
    super();
    this.assertHasValue("userId", userId);
    this.assertHasValue("sdkService", sdkService);
    this.assertHasValue("dataPacker", dataPacker);
  }

  async encrypt<Secret>(secret: Jsonify<Secret>): Promise<EncString> {
    this.assertHasValue("secret", secret);

    const packed = this.dataPacker.pack(secret);
    const encryptedString = await firstValueFrom(
      this.sdkService.userClient$(this.userId).pipe(
        map((sdk) => {
          if (!sdk) {
            throw new Error("SDK not available");
          }
          using ref = sdk.take();
          return ref.value.crypto().encrypt_with_local_user_data_key(packed);
        }),
      ),
    );

    return new EncString(encryptedString);
  }

  async decrypt<Secret>(secret: EncString): Promise<Jsonify<Secret>> {
    this.assertHasValue("secret", secret);

    const decrypted = await firstValueFrom(
      this.sdkService.userClient$(this.userId).pipe(
        map((sdk) => {
          if (!sdk) {
            throw new Error("SDK not available");
          }
          using ref = sdk.take();
          return ref.value.crypto().decrypt_with_local_user_data_key(secret.encryptedString);
        }),
      ),
    );

    return this.dataPacker.unpack<Secret>(decrypted);
  }

  private assertHasValue(name: string, value: any) {
    if (value === undefined || value === null) {
      throw new Error(`${name} cannot be null or undefined`);
    }
  }
}
