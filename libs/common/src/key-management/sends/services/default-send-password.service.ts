import { SEND_KDF_ITERATIONS } from "../../../tools/send/send-kdf";
import { CryptoFunctionService } from "../../crypto/abstractions/crypto-function.service";
import { SendPasswordService } from "../abstractions/send-password.service";
import { SendHashedPassword, SendPasswordKeyMaterial } from "../types/send-hashed-password.type";

export class DefaultSendPasswordService implements SendPasswordService {
  constructor(private cryptoFunctionService: CryptoFunctionService) {}

  async hashPassword(
    password: string,
    keyMaterial: SendPasswordKeyMaterial,
  ): Promise<SendHashedPassword> {
    if (!password || !keyMaterial) {
      throw new Error("Password and key material are required.");
    }

    // Derive a password hash using the key material.
    const passwordHash = await this.cryptoFunctionService.pbkdf2(
      password,
      keyMaterial,
      "sha256",
      SEND_KDF_ITERATIONS,
    );

    return passwordHash as SendHashedPassword;
  }
}
