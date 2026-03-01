import { firstValueFrom } from "rxjs";

import { MasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { KdfConfigService, KeyService } from "@bitwarden/key-management";
import { UserId } from "@bitwarden/user-core";

import { ApiService } from "../../../abstractions/api.service";
import { EmailTokenRequest } from "../../models/request/email-token.request";
import { EmailRequest } from "../../models/request/email.request";
import { assertNonNullish } from "../../utils";

import { ChangeEmailService } from "./change-email.service";

export class DefaultChangeEmailService implements ChangeEmailService {
  constructor(
    private masterPasswordService: MasterPasswordServiceAbstraction,
    private kdfConfigService: KdfConfigService,
    private apiService: ApiService,
    private keyService: KeyService,
  ) { }

  async requestEmailToken(masterPassword: string, newEmail: string, userId: UserId): Promise<void> {
    let request: EmailTokenRequest;

    const saltForUser = await firstValueFrom(this.masterPasswordService.saltForUser$(userId));
    assertNonNullish(saltForUser, "salt");

    const kdf = await firstValueFrom(this.kdfConfigService.getKdfConfig$(userId));
    assertNonNullish(kdf, "kdf");

    const authenticationData =
      await this.masterPasswordService.makeMasterPasswordAuthenticationData(
        masterPassword,
        kdf,
        saltForUser,
      );

    request = EmailTokenRequest.forNewEmail(authenticationData, newEmail);
    await this.apiService.send("POST", "/accounts/email-token", request, userId, false);
  }

  async confirmEmailChange(
    masterPassword: string,
    newEmail: string,
    token: string,
    userId: UserId,
  ): Promise<void> {
    let request: EmailRequest;

    const kdf = await firstValueFrom(this.kdfConfigService.getKdfConfig$(userId));
    assertNonNullish(kdf, "kdf");

    const userKey = await firstValueFrom(this.keyService.userKey$(userId));
    assertNonNullish(userKey, "userKey");

    // Existing salt required for verification
    const existingSalt = await firstValueFrom(this.masterPasswordService.saltForUser$(userId));
    assertNonNullish(existingSalt, "salt");

    // Create auth data with existing salt (proves user knows password)
    const existingAuthData =
      await this.masterPasswordService.makeMasterPasswordAuthenticationData(
        masterPassword,
        kdf,
        existingSalt,
      );

    const newSalt = this.masterPasswordService.emailToSalt(newEmail);
    const newAuthData = await this.masterPasswordService.makeMasterPasswordAuthenticationData(
      masterPassword,
      kdf,
      newSalt,
    );
    const newUnlockData = await this.masterPasswordService.makeMasterPasswordUnlockData(
      masterPassword,
      kdf,
      newSalt,
      userKey,
    );

    request = EmailRequest.newConstructor(newAuthData, newUnlockData);
    request.newEmail = newEmail;
    request.token = token;
    request.authenticateWith(existingAuthData);

    await this.apiService.send("POST", "/accounts/email", request, userId, false);
  }
}
