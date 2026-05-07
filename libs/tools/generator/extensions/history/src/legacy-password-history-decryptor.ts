import { firstValueFrom, map } from "rxjs";

import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { UserId } from "@bitwarden/common/types/guid";

import { GeneratedPasswordHistory } from "./generated-password-history";

/** Strategy that decrypts a password history */
export class LegacyPasswordHistoryDecryptor {
  constructor(
    private userId: UserId,
    private sdkService: SdkService,
  ) {}

  /** Decrypts a password history. */
  async decrypt(history: GeneratedPasswordHistory[]): Promise<GeneratedPasswordHistory[]> {
    const promises = (history ?? []).map(async (item) => {
      const decrypted = await firstValueFrom(
        this.sdkService.userClient$(this.userId).pipe(
          map((sdk) => {
            if (!sdk) {
              throw new Error("SDK not available");
            }
            using ref = sdk.take();
            return ref.value.crypto().decrypt_with_local_user_data_key(item.password);
          }),
        ),
      );
      return new GeneratedPasswordHistory(decrypted, item.date);
    });

    return Promise.all(promises);
  }
}
