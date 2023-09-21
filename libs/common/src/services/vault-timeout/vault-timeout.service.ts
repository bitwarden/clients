import { firstValueFrom } from "rxjs";

import { SearchService } from "../../abstractions/search.service";
import { VaultTimeoutSettingsService } from "../../abstractions/vault-timeout/vault-timeout-settings.service";
import { VaultTimeoutService as VaultTimeoutServiceAbstraction } from "../../abstractions/vault-timeout/vault-timeout.service";
import { AuthService } from "../../auth/abstractions/auth.service";
import { AuthenticationStatus } from "../../auth/enums/authentication-status";
import { ClientType } from "../../enums";
import { VaultTimeoutAction } from "../../enums/vault-timeout-action.enum";
import { CryptoService } from "../../platform/abstractions/crypto.service";
import { MessagingService } from "../../platform/abstractions/messaging.service";
import { PlatformUtilsService } from "../../platform/abstractions/platform-utils.service";
import { StateService } from "../../platform/abstractions/state.service";
import { CipherService } from "../../vault/abstractions/cipher.service";
import { CollectionService } from "../../vault/abstractions/collection.service";
import { FolderService } from "../../vault/abstractions/folder/folder.service.abstraction";

export class VaultTimeoutService implements VaultTimeoutServiceAbstraction {
  private inited = false;

  constructor(
    private cipherService: CipherService,
    private folderService: FolderService,
    private collectionService: CollectionService,
    private cryptoService: CryptoService,
    protected platformUtilsService: PlatformUtilsService,
    private messagingService: MessagingService,
    private searchService: SearchService,
    private stateService: StateService,
    private authService: AuthService,
    private vaultTimeoutSettingsService: VaultTimeoutSettingsService,
    private lockedCallback: (userId?: string) => Promise<void> = null,
    private loggedOutCallback: (expired: boolean, userId?: string) => Promise<void> = null
  ) {}

  async init(checkOnInterval: boolean) {
    if (this.inited) {
      return;
    }
    // TODO: Remove after 2023.10 release (https://bitwarden.atlassian.net/browse/PM-3483)
    await this.migrateKeyForNeverLockIfNeeded();

    this.inited = true;
    if (checkOnInterval) {
      this.startCheck();
    }
  }

  startCheck() {
    this.checkVaultTimeout();
    setInterval(() => this.checkVaultTimeout(), 10 * 1000); // check every 10 seconds
  }

  async checkVaultTimeout(): Promise<void> {
    if (await this.platformUtilsService.isViewOpen()) {
      return;
    }

    const accounts = await firstValueFrom(this.stateService.accounts$);
    for (const userId in accounts) {
      if (userId != null && (await this.shouldLock(userId))) {
        await this.executeTimeoutAction(userId);
      }
    }
  }

  async lock(userId?: string): Promise<void> {
    const authed = await this.stateService.getIsAuthenticated({ userId: userId });
    if (!authed) {
      return;
    }

    const availableActions = await firstValueFrom(
      this.vaultTimeoutSettingsService.availableVaultTimeoutActions$()
    );
    const supportsLock = availableActions.includes(VaultTimeoutAction.Lock);
    if (!supportsLock) {
      await this.logOut(userId);
    }

    if (userId == null || userId === (await this.stateService.getUserId())) {
      this.searchService.clearIndex();
      await this.folderService.clearCache();
    }

    await this.stateService.setEverBeenUnlocked(true, { userId: userId });
    await this.stateService.setUserKeyAutoUnlock(null, { userId: userId });
    await this.stateService.setCryptoMasterKeyAuto(null, { userId: userId });

    await this.cryptoService.clearUserKey(false, userId);
    await this.cryptoService.clearMasterKey(userId);
    await this.cryptoService.clearOrgKeys(true, userId);
    await this.cryptoService.clearKeyPair(true, userId);

    await this.cipherService.clearCache(userId);
    await this.collectionService.clearCache(userId);

    this.messagingService.send("locked", { userId: userId });

    if (this.lockedCallback != null) {
      await this.lockedCallback(userId);
    }
  }

  async logOut(userId?: string): Promise<void> {
    if (this.loggedOutCallback != null) {
      await this.loggedOutCallback(false, userId);
    }
  }

  private async shouldLock(userId: string): Promise<boolean> {
    const authStatus = await this.authService.getAuthStatus(userId);
    if (
      authStatus === AuthenticationStatus.Locked ||
      authStatus === AuthenticationStatus.LoggedOut
    ) {
      return false;
    }

    const vaultTimeout = await this.vaultTimeoutSettingsService.getVaultTimeout(userId);
    if (vaultTimeout == null || vaultTimeout < 0) {
      return false;
    }

    const lastActive = await this.stateService.getLastActive({ userId: userId });
    if (lastActive == null) {
      return false;
    }

    const vaultTimeoutSeconds = vaultTimeout * 60;
    const diffSeconds = (new Date().getTime() - lastActive) / 1000;
    return diffSeconds >= vaultTimeoutSeconds;
  }

  private async executeTimeoutAction(userId: string): Promise<void> {
    const timeoutAction = await firstValueFrom(
      this.vaultTimeoutSettingsService.vaultTimeoutAction$(userId)
    );
    timeoutAction === VaultTimeoutAction.LogOut
      ? await this.logOut(userId)
      : await this.lock(userId);
  }

  private async migrateKeyForNeverLockIfNeeded(): Promise<void> {
    // Web can't set vault timeout to never
    if (this.platformUtilsService.getClientType() == ClientType.Web) {
      return;
    }
    const accounts = await firstValueFrom(this.stateService.accounts$);
    for (const userId in accounts) {
      if (userId != null) {
        await this.cryptoService.migrateAutoKeyIfNeeded(userId);
        // Legacy users should be logged out since we're not on the web vault and can't migrate.
        if (await this.cryptoService.isLegacyUser(null, userId)) {
          await this.logOut(userId);
        }
      }
    }
  }
}
