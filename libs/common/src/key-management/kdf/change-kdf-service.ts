import { firstValueFrom, map } from "rxjs";

import { assertNonNullish } from "@bitwarden/common/auth/utils";
import { KdfRequest } from "@bitwarden/common/models/request/kdf.request";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { UserId } from "@bitwarden/common/types/guid";
// eslint-disable-next-line no-restricted-imports
import { KdfConfig, KdfConfigService, KeyService } from "@bitwarden/key-management";

import { MasterPasswordServiceAbstraction } from "../master-password/abstractions/master-password.service.abstraction";
import {
  MasterKeyWrappedUserKey,
  MasterPasswordAuthenticationData,
  MasterPasswordAuthenticationHash,
  MasterPasswordSalt,
  MasterPasswordUnlockData,
} from "../master-password/types/master-password.types";

import { ChangeKdfApiService } from "./change-kdf-api.service.abstraction";
import { ChangeKdfService } from "./change-kdf-service.abstraction";

export class DefaultChangeKdfService implements ChangeKdfService {
  constructor(
    private masterPasswordService: MasterPasswordServiceAbstraction,
    private keyService: KeyService,
    private kdfConfigService: KdfConfigService,
    private changeKdfApiService: ChangeKdfApiService,
    private sdkService: SdkService,
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

    const authenticationData: MasterPasswordAuthenticationData = {
      salt: updateKdfResult.masterPasswordAuthenticationData.salt as MasterPasswordSalt,
      kdf: kdf,
      masterPasswordAuthenticationHash: updateKdfResult.masterPasswordAuthenticationData
        .masterPasswordAuthenticationHash as MasterPasswordAuthenticationHash,
    };
    const unlockData: MasterPasswordUnlockData = new MasterPasswordUnlockData(
      updateKdfResult.masterPasswordUnlockData.salt as MasterPasswordSalt,
      kdf,
      updateKdfResult.masterPasswordUnlockData.masterKeyWrappedUserKey as MasterKeyWrappedUserKey,
    );
    const oldAuthenticationData: MasterPasswordAuthenticationData = {
      salt: updateKdfResult.oldMasterPasswordAuthenticationData.salt as MasterPasswordSalt,
      kdf: kdf,
      masterPasswordAuthenticationHash: updateKdfResult.oldMasterPasswordAuthenticationData
        .masterPasswordAuthenticationHash as MasterPasswordAuthenticationHash,
    };

    const request = new KdfRequest(authenticationData, unlockData);
    request.authenticateWith(oldAuthenticationData);
    await this.changeKdfApiService.updateUserKdfParams(request);
  }
}
