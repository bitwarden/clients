import { firstValueFrom, map } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { KdfConfig } from "@bitwarden/key-management";

import { assertNonNullish } from "../../auth/utils";
import { SdkService } from "../../platform/abstractions/sdk/sdk.service";
import { UserId } from "../../types/guid";
import { EncString } from "../crypto/models/enc-string";
import { InternalMasterPasswordServiceAbstraction } from "../master-password/abstractions/master-password.service.abstraction";

import { ChangeKdfService } from "./change-kdf.service.abstraction";

export class DefaultChangeKdfService implements ChangeKdfService {
  constructor(
    private sdkService: SdkService,
    private masterPasswordService: InternalMasterPasswordServiceAbstraction,
  ) {}

  async updateUserKdfParams(masterPassword: string, kdf: KdfConfig, userId: UserId): Promise<void> {
    assertNonNullish(masterPassword, "masterPassword");
    assertNonNullish(kdf, "kdf");
    assertNonNullish(userId, "userId");

    // The SDK re-derives the master-password authentication and unlock data for the new KDF,
    // posts the change to the server, and persists the new unlock data and KDF config to state
    // via the state bridge.
    await firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        map(async (sdk) => {
          if (!sdk) {
            throw new Error("SDK not available");
          }

          using ref = sdk.take();

          await ref.value.user_crypto_management().change_kdf(masterPassword, kdf.toSdkConfig());
        }),
      ),
    );

    // Keep the legacy locally-cached master key and master-key-wrapped user key in sync so that
    // unlock verification etc. still works. Ownership of this state is not yet migrated to the SDK,
    // so it stays client-side. The SDK has already written the new unlock data to state, so we read
    // it back to derive the master key.
    const unlockData = await firstValueFrom(
      this.masterPasswordService.masterPasswordUnlockData$(userId),
    );
    assertNonNullish(unlockData, "unlockData");
    await this.masterPasswordService.setLegacyMasterKeyFromUnlockData(
      masterPassword,
      unlockData,
      userId,
    );
    await this.masterPasswordService.setMasterKeyEncryptedUserKey(
      new EncString(unlockData.masterKeyWrappedUserKey),
      userId,
    );
  }
}
