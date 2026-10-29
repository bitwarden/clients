import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { LogoutReason, LogoutService, NewActiveUser } from "@bitwarden/common/auth/logout";
import { EventUploadService } from "@bitwarden/common/dirt/event-logs";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { InternalFolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { KeyService } from "@bitwarden/key-management";
import { LogService } from "@bitwarden/logging";
import { StateEventRunnerService, StateService } from "@bitwarden/state";

/**
 * Clears the user's session in-process. The CLI has no listener for the `logout` message and
 * holds a single account, so logout never yields a new active user.
 */
export class CliLogoutService implements LogoutService {
  constructor(
    private authService: AuthService,
    private accountService: AccountService,
    private eventUploadService: EventUploadService,
    private keyService: KeyService,
    private cipherService: CipherService,
    private folderService: InternalFolderService,
    private stateEventRunnerService: StateEventRunnerService,
    private stateService: StateService,
    private tokenService: TokenService,
    private logService: LogService,
  ) {}

  async logout(userId: UserId, logoutReason: LogoutReason): Promise<NewActiveUser | undefined> {
    this.logService.info("Logging out user %s for reason: %s", userId, logoutReason);

    this.authService.logOut(() => {
      /* Do nothing */
    });
    await Promise.all([
      this.eventUploadService.uploadEvents(userId),
      this.keyService.clearKeys(userId),
      this.cipherService.clear(userId),
      this.folderService.clear(userId),
    ]);

    await this.stateEventRunnerService.handleEvent("logout", userId);

    await this.stateService.clean({ userId });
    await this.tokenService.clearTokens(userId);
    await this.accountService.clean(userId);
    await this.accountService.switchAccount(null);
    delete process.env.BW_SESSION;

    return undefined;
  }
}
