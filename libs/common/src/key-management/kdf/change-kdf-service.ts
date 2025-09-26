import { assertNonNullish } from "@bitwarden/common/auth/utils";
import { KdfRequest } from "@bitwarden/common/models/request/kdf.request";
import { UserId } from "@bitwarden/common/types/guid";
// eslint-disable-next-line no-restricted-imports
import { KdfConfig, KdfConfigService, KeyService } from "@bitwarden/key-management";

import { MasterPasswordServiceAbstraction } from "../master-password/abstractions/master-password.service.abstraction";
import { firstValueFromOrThrow } from "../utils";

import { ChangeKdfApiService } from "./change-kdf-api.service.abstraction";
import { ChangeKdfService } from "./change-kdf-service.abstraction";

export class DefaultChangeKdfService implements ChangeKdfService {
  constructor(
    private masterPasswordService: MasterPasswordServiceAbstraction,
    private keyService: KeyService,
    private kdfConfigService: KdfConfigService,
    private changeKdfApiService: ChangeKdfApiService,
  ) {}

  async updateUserKdfParams(masterPassword: string, kdf: KdfConfig, userId: UserId): Promise<void> {
    assertNonNullish(masterPassword, "masterPassword");
    assertNonNullish(kdf, "kdf");
    assertNonNullish(userId, "userId");

    const userKey = await firstValueFromOrThrow(this.keyService.userKey$(userId), "userKey");
    const salt = await firstValueFromOrThrow(
      this.masterPasswordService.saltForUser$(userId),
      "salt",
    );
    const oldKdfConfig = await firstValueFromOrThrow(
      this.kdfConfigService.getKdfConfig$(userId),
      "oldKdfConfig",
    );

    const oldAuthenticationData =
      await this.masterPasswordService.makeMasterPasswordAuthenticationData(
        masterPassword,
        oldKdfConfig,
        salt,
      );
    const authenticationData =
      await this.masterPasswordService.makeMasterPasswordAuthenticationData(
        masterPassword,
        kdf,
        salt,
      );
    const unlockData = await this.masterPasswordService.makeMasterPasswordUnlockData(
      masterPassword,
      kdf,
      salt,
      userKey,
    );

    const request = new KdfRequest(authenticationData, unlockData);
    request.authenticateWith(oldAuthenticationData);
    await this.changeKdfApiService.updateUserKdfParams(request);
  }
}
