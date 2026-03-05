import { firstValueFrom } from "rxjs";

import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { UserId } from "@bitwarden/common/types/guid";
import { KeyService } from "@bitwarden/key-management";

import { GeneratedPasswordHistory } from "./generated-password-history";

/** Strategy that decrypts a password history */
export class LegacyPasswordHistoryDecryptor {
  constructor(
    private userId: UserId,
    private keyService: KeyService,
    private encryptService: EncryptService,
  ) {}

  /** Decrypts a password history. */
  async decrypt(history: GeneratedPasswordHistory[]): Promise<GeneratedPasswordHistory[]> {
    const key = await firstValueFrom(this.keyService.userKey$(this.userId));

    if (key == undefined) {
      throw new Error("No user key found for decryption");
    }

    const promises = (history ?? []).map(async (item) => {
      const encrypted = new EncString(item.password);
      const decrypted = await this.encryptService.decryptString(encrypted, key);
      return new GeneratedPasswordHistory(decrypted, item.date);
    });

    const decrypted = await Promise.all(promises);

    return decrypted;
  }
}
