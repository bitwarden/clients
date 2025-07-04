import { Opaque } from "type-fest";

import { Utils } from "../../platform/misc/utils";
import { SEND_KDF_ITERATIONS } from "../../tools/send/send-kdf";
import { CryptoFunctionService } from "../crypto/abstractions/crypto-function.service";

// TODO: remove this comment:
// Code taken from send access.component.ts load method.

// TODO: add test file for this service.
/**
 * Represents an opaque hashed send password as a base64 encoded string.
 */
export type SendHashedPassword = Opaque<string, "SendHashedPassword">;

/**
 * Service for managing passwords for sends.
 */
export class SendPasswordService {
  constructor(private cryptoFunctionService: CryptoFunctionService) {}

  async hashPassword(password: string, keyMaterialUrlB64: string): Promise<SendHashedPassword> {
    if (!password || !keyMaterialUrlB64) {
      throw new Error("Password and key material URL base64 string are required.");
    }

    // Convert the key material URL base64 string to an array.
    const keyMaterialArray = Utils.fromUrlB64ToArray(keyMaterialUrlB64);

    // Derive a password hash using the key material.
    const passwordHash = await this.cryptoFunctionService.pbkdf2(
      password,
      keyMaterialArray,
      "sha256",
      SEND_KDF_ITERATIONS,
    );

    // Convert the password hash to a base64 string and return as proper type
    return Utils.fromBufferToB64(passwordHash) as SendHashedPassword;
  }
}
