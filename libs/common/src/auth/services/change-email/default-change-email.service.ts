import { firstValueFrom } from "rxjs";

import { MasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// Marked for removal when PM-30811 feature flag is unwound.
// eslint-disable-next-line no-restricted-imports
import { KdfConfigService, KeyService } from "@bitwarden/key-management";
import { UserId } from "@bitwarden/user-core";

import { ApiService } from "../../../abstractions/api.service";
import { FeatureFlag } from "../../../enums/feature-flag.enum";
import { ConfigService } from "../../../platform/abstractions/config/config.service";
import { EmailTokenRequest } from "../../models/request/email-token.request";
import { EmailRequest } from "../../models/request/email.request";
import { assertNonNullish } from "../../utils";

import { ChangeEmailService } from "./change-email.service";

export class DefaultChangeEmailService implements ChangeEmailService {
  /**
   *
   */
  constructor(
    private configService: ConfigService,
    private masterPasswordService: MasterPasswordServiceAbstraction,
    private kdfConfigService: KdfConfigService,
    private apiService: ApiService,
    private keyService: KeyService,
  ) {}

  async requestEmailToken(masterPassword: string, newEmail: string, userId: UserId): Promise<void> {
    let request: EmailTokenRequest;

    if (
      await this.configService.getFeatureFlag(FeatureFlag.PM30811_ChangeEmailNewAuthenticationApis)
    ) {
      const saltForUser = await firstValueFrom(this.masterPasswordService.saltForUser$(userId));
      const kdf = await firstValueFrom(this.kdfConfigService.getKdfConfig$(userId));
      const authenticationData =
        await this.masterPasswordService.makeMasterPasswordAuthenticationData(
          masterPassword,
          kdf,
          saltForUser,
        );

      request = EmailTokenRequest.newConstructor(authenticationData, newEmail);
    } else {
      // Legacy path: marked for removal when PM-30811 flag is unwound.
      // See: https://bitwarden.atlassian.net/browse/PM-30811

      request = new EmailTokenRequest();
      request.newEmail = newEmail;
      request.masterPasswordHash = await this.keyService.hashMasterKey(
        masterPassword,
        await this.keyService.getOrDeriveMasterKey(masterPassword, userId),
      );
    }

    await this.apiService.send("POST", "/accounts/email-token", request, userId, true);
  }

  async confirmEmailChange(
    masterPassword: string,
    newEmail: string,
    token: string,
    userId: UserId,
  ): Promise<void> {
    let request: EmailRequest;

    if (
      await this.configService.getFeatureFlag(FeatureFlag.PM30811_ChangeEmailNewAuthenticationApis)
    ) {
      const saltForUser = await firstValueFrom(this.masterPasswordService.saltForUser$(userId));
      const kdf = await firstValueFrom(this.kdfConfigService.getKdfConfig$(userId));
      const authenticationData =
        await this.masterPasswordService.makeMasterPasswordAuthenticationData(
          masterPassword,
          kdf,
          saltForUser,
        );
      const userKey = await firstValueFrom(this.keyService.userKey$(userId));
      assertNonNullish(userKey, "userKey");
      const unlockData = await this.masterPasswordService.makeMasterPasswordUnlockData(
        masterPassword,
        kdf,
        saltForUser,
        userKey,
      );

      request = EmailRequest.newConstructor(authenticationData, unlockData);
    } else {
      // Legacy path: marked for removal when PM-30811 flag is unwound.
      // See: https://bitwarden.atlassian.net/browse/PM-30811

      request = new EmailRequest();
      request.token = token;
      request.newEmail = newEmail;
      request.masterPasswordHash = await this.keyService.hashMasterKey(
        masterPassword,
        await this.keyService.getOrDeriveMasterKey(masterPassword, userId),
      );

      const kdfConfig = await firstValueFrom(this.kdfConfigService.getKdfConfig$(userId));
      if (kdfConfig == null) {
        throw new Error("Missing kdf config");
      }
      const newMasterKey = await this.keyService.makeMasterKey(masterPassword, newEmail, kdfConfig);
      request.newMasterPasswordHash = await this.keyService.hashMasterKey(
        masterPassword,
        newMasterKey,
      );
      const userKey = await firstValueFrom(this.keyService.userKey$(userId));
      if (userKey == null) {
        throw new Error("Can't find UserKey");
      }
      const newUserKey = await this.keyService.encryptUserKeyWithMasterKey(newMasterKey, userKey);
      const encryptedUserKey = newUserKey[1]?.encryptedString;
      if (encryptedUserKey == null) {
        throw new Error("Missing Encrypted User Key");
      }
      request.key = encryptedUserKey;
    }

    await this.apiService.send("POST", "/accounts/email", request, userId, false);
  }
}
