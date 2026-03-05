import { firstValueFrom, map } from "rxjs";

import { assertNonNullish } from "@bitwarden/common/auth/utils";
import { HashPurpose } from "@bitwarden/common/platform/enums";
import { UserId } from "@bitwarden/common/types/guid";
// eslint-disable-next-line no-restricted-imports
import { KdfConfig, KeyService } from "@bitwarden/key-management";

import { KdfRequest } from "../../models/request/kdf.request";
import { SdkService } from "../../platform/abstractions/sdk/sdk.service";
import { InternalMasterPasswordServiceAbstraction } from "../master-password/abstractions/master-password.service.abstraction";
import {
  fromSdkAuthenticationData,
  MasterPasswordAuthenticationData,
  MasterPasswordUnlockData,
} from "../master-password/types/master-password.types";

import { ChangeKdfApiService } from "./change-kdf-api.service.abstraction";
import { ChangeKdfService } from "./change-kdf.service.abstraction";

export class DefaultChangeKdfService implements ChangeKdfService {
  constructor(
    private changeKdfApiService: ChangeKdfApiService,
    private sdkService: SdkService,
    private keyService: KeyService,
    private masterPasswordService: InternalMasterPasswordServiceAbstraction,
  ) {}

  async updateUserKdfParams(masterPassword: string, kdf: KdfConfig, userId: UserId): Promise<void> {
    assertNonNullish(masterPassword, "masterPassword");
    assertNonNullish(kdf, "kdf");
    assertNonNullish(userId, "userId");
    const updateKdfResult = await firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        map((sdk) => {
          if (!sdk) {
            throw new Error("SDK not available");
          }

          using ref = sdk.take();

          const updateKdfResponse = ref.value
            .crypto()
            .make_update_kdf(masterPassword, kdf.toSdkConfig());
          return updateKdfResponse;
        }),
      ),
    );

    const authenticationData: MasterPasswordAuthenticationData = fromSdkAuthenticationData(
      updateKdfResult.masterPasswordAuthenticationData,
    );
    const unlockData: MasterPasswordUnlockData = MasterPasswordUnlockData.fromSdk(
      updateKdfResult.masterPasswordUnlockData,
    );
    const oldAuthenticationData: MasterPasswordAuthenticationData = fromSdkAuthenticationData(
      updateKdfResult.oldMasterPasswordAuthenticationData,
    );

    const request = new KdfRequest(authenticationData, unlockData);
    request.authenticateWith(oldAuthenticationData);
    await this.changeKdfApiService.updateUserKdfParams(request);

    // Update the locally stored master key and hash, so that UV, etc. still works
    const masterKey = await this.keyService.makeMasterKey(
      masterPassword,
      unlockData.salt,
      unlockData.kdf,
    );
    const localMasterKeyHash = await this.keyService.hashMasterKey(
      masterPassword,
      masterKey,
      HashPurpose.LocalAuthorization,
    );
    await this.masterPasswordService.setMasterKeyHash(localMasterKeyHash, userId);
    await this.masterPasswordService.setMasterKey(masterKey, userId);
  }
}
