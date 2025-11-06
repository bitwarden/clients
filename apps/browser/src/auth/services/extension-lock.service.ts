import { DefaultLockService, LogoutService } from "@bitwarden/auth/common";
import MainBackground from "@bitwarden/browser/background/main.background";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { ProcessReloadServiceAbstraction } from "@bitwarden/common/key-management/abstractions/process-reload.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { VaultTimeoutSettingsService } from "@bitwarden/common/key-management/vault-timeout";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { SystemService } from "@bitwarden/common/platform/abstractions/system.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { SearchService } from "@bitwarden/common/vault/abstractions/search.service";
import { BiometricsService, KeyService } from "@bitwarden/key-management";
import { LogService } from "@bitwarden/logging";
import { StateEventRunnerService } from "@bitwarden/state";

export class ExtensionLockService extends DefaultLockService {
  constructor(
    accountService: AccountService,
    biometricService: BiometricsService,
    vaultTimeoutSettingsService: VaultTimeoutSettingsService,
    logoutService: LogoutService,
    messagingService: MessagingService,
    searchService: SearchService,
    folderService: FolderService,
    masterPasswordService: InternalMasterPasswordServiceAbstraction,
    stateEventRunnerService: StateEventRunnerService,
    cipherService: CipherService,
    authService: AuthService,
    systemService: SystemService,
    processReloadService: ProcessReloadServiceAbstraction,
    logService: LogService,
    keyService: KeyService,
    private readonly main: MainBackground,
  ) {
    super(
      accountService,
      biometricService,
      vaultTimeoutSettingsService,
      logoutService,
      messagingService,
      searchService,
      folderService,
      masterPasswordService,
      stateEventRunnerService,
      cipherService,
      authService,
      systemService,
      processReloadService,
      logService,
      keyService,
    );
  }

  async runPlatformOnLockActions(): Promise<void> {
    await this.main.refreshMenu(true);
  }
}
