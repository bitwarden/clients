import { LogoutService } from "@bitwarden/auth/common";
import MainBackground from "@bitwarden/browser/background/main.background";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { ProcessReloadServiceAbstraction } from "@bitwarden/common/key-management/abstractions/process-reload.service";
import { VaultTimeoutSettingsService } from "@bitwarden/common/key-management/vault-timeout";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { SystemService } from "@bitwarden/common/platform/abstractions/system.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { BiometricsService, KeyService } from "@bitwarden/key-management";
import { LogService } from "@bitwarden/logging";
import { StateEventRunnerService } from "@bitwarden/state";
import { DefaultLockService, LockSource } from "@bitwarden/unlock";
import { UserId } from "@bitwarden/user-core";

export class ExtensionLockService extends DefaultLockService {
  constructor(
    accountService: AccountService,
    biometricService: BiometricsService,
    vaultTimeoutSettingsService: VaultTimeoutSettingsService,
    logoutService: LogoutService,
    messagingService: MessagingService,
    folderService: FolderService,
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
      folderService,
      stateEventRunnerService,
      cipherService,
      authService,
      systemService,
      processReloadService,
      logService,
      keyService,
    );
  }

  async runPlatformOnLockActions(userId: UserId, source: LockSource): Promise<void> {
    await super.runPlatformOnLockActions(userId, source);
    await this.main.refreshMenu(true);
  }
}
