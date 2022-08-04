import { ApiService as ApiServiceAbstraction } from "@bitwarden/common/abstractions/api.service";
import { AppIdService as AppIdServiceAbstraction } from "@bitwarden/common/abstractions/appId.service";
import { AuditService as AuditServiceAbstraction } from "@bitwarden/common/abstractions/audit.service";
import { AuthService as AuthServiceAbstraction } from "@bitwarden/common/abstractions/auth.service";
import { CipherService as CipherServiceAbstraction } from "@bitwarden/common/abstractions/cipher.service";
import { CollectionService as CollectionServiceAbstraction } from "@bitwarden/common/abstractions/collection.service";
import { CryptoService as CryptoServiceAbstraction } from "@bitwarden/common/abstractions/crypto.service";
import { CryptoFunctionService as CryptoFunctionServiceAbstraction } from "@bitwarden/common/abstractions/cryptoFunction.service";
import { EnvironmentService as EnvironmentServiceAbstraction } from "@bitwarden/common/abstractions/environment.service";
import { EventService as EventServiceAbstraction } from "@bitwarden/common/abstractions/event.service";
import { ExportService as ExportServiceAbstraction } from "@bitwarden/common/abstractions/export.service";
import { FileUploadService as FileUploadServiceAbstraction } from "@bitwarden/common/abstractions/fileUpload.service";
import { FolderApiServiceAbstraction } from "@bitwarden/common/abstractions/folder/folder-api.service.abstraction";
import { InternalFolderService as InternalFolderServiceAbstraction } from "@bitwarden/common/abstractions/folder/folder.service.abstraction";
import { I18nService as I18nServiceAbstraction } from "@bitwarden/common/abstractions/i18n.service";
import { KeyConnectorService as KeyConnectorServiceAbstraction } from "@bitwarden/common/abstractions/keyConnector.service";
import { LogService as LogServiceAbstraction } from "@bitwarden/common/abstractions/log.service";
import { MessagingService as MessagingServiceAbstraction } from "@bitwarden/common/abstractions/messaging.service";
import { NotificationsService as NotificationsServiceAbstraction } from "@bitwarden/common/abstractions/notifications.service";
import { OrganizationService as OrganizationServiceAbstraction } from "@bitwarden/common/abstractions/organization.service";
import { PasswordGenerationService as PasswordGenerationServiceAbstraction } from "@bitwarden/common/abstractions/passwordGeneration.service";
import { PlatformUtilsService as PlatformUtilsServiceAbstraction } from "@bitwarden/common/abstractions/platformUtils.service";
import { PolicyService as PolicyServiceAbstraction } from "@bitwarden/common/abstractions/policy.service";
import { InternalProviderService as InternalProviderServiceAbstraction } from "@bitwarden/common/abstractions/provider/provider.service.abstraction";
import { SearchService as SearchServiceAbstraction } from "@bitwarden/common/abstractions/search.service";
import { SendService as SendServiceAbstraction } from "@bitwarden/common/abstractions/send.service";
import { SettingsService as SettingsServiceAbstraction } from "@bitwarden/common/abstractions/settings.service";
import { AbstractStorageService } from "@bitwarden/common/abstractions/storage.service";
import { SyncService as SyncServiceAbstraction } from "@bitwarden/common/abstractions/sync.service";
import { SystemService as SystemServiceAbstraction } from "@bitwarden/common/abstractions/system.service";
import { TokenService as TokenServiceAbstraction } from "@bitwarden/common/abstractions/token.service";
import { TotpService as TotpServiceAbstraction } from "@bitwarden/common/abstractions/totp.service";
import { TwoFactorService as TwoFactorServiceAbstraction } from "@bitwarden/common/abstractions/twoFactor.service";
import { UserVerificationService as UserVerificationServiceAbstraction } from "@bitwarden/common/abstractions/userVerification.service";
import { UsernameGenerationService as UsernameGenerationServiceAbstraction } from "@bitwarden/common/abstractions/usernameGeneration.service";
import { VaultTimeoutService as VaultTimeoutServiceAbstraction } from "@bitwarden/common/abstractions/vaultTimeout.service";
import { AuthenticationStatus } from "@bitwarden/common/enums/authenticationStatus";
import { CipherRepromptType } from "@bitwarden/common/enums/cipherRepromptType";
import { CipherType } from "@bitwarden/common/enums/cipherType";
import { StateFactory } from "@bitwarden/common/factories/stateFactory";
import { GlobalState } from "@bitwarden/common/models/domain/globalState";
import { CipherView } from "@bitwarden/common/models/view/cipherView";
import { ApiService } from "@bitwarden/common/services/api.service";
import { AppIdService } from "@bitwarden/common/services/appId.service";
import { AuditService } from "@bitwarden/common/services/audit.service";
import { AuthService } from "@bitwarden/common/services/auth.service";
import { CipherService } from "@bitwarden/common/services/cipher.service";
import { CollectionService } from "@bitwarden/common/services/collection.service";
import { ConsoleLogService } from "@bitwarden/common/services/consoleLog.service";
import { ContainerService } from "@bitwarden/common/services/container.service";
import { EncryptService } from "@bitwarden/common/services/encrypt.service";
import { EnvironmentService } from "@bitwarden/common/services/environment.service";
import { EventService } from "@bitwarden/common/services/event.service";
import { ExportService } from "@bitwarden/common/services/export.service";
import { FileUploadService } from "@bitwarden/common/services/fileUpload.service";
import { FolderApiService } from "@bitwarden/common/services/folder/folder-api.service";
import { FolderService } from "@bitwarden/common/services/folder/folder.service";
import { KeyConnectorService } from "@bitwarden/common/services/keyConnector.service";
import { MemoryStorageService } from "@bitwarden/common/services/memoryStorage.service";
import { NotificationsService } from "@bitwarden/common/services/notifications.service";
import { OrganizationService } from "@bitwarden/common/services/organization.service";
import { PasswordGenerationService } from "@bitwarden/common/services/passwordGeneration.service";
import { PolicyService } from "@bitwarden/common/services/policy.service";
import { ProviderService } from "@bitwarden/common/services/provider/provider.service";
import { SearchService } from "@bitwarden/common/services/search.service";
import { SendService } from "@bitwarden/common/services/send.service";
import { SettingsService } from "@bitwarden/common/services/settings.service";
import { StateMigrationService } from "@bitwarden/common/services/stateMigration.service";
import { SyncService } from "@bitwarden/common/services/sync.service";
import { SystemService } from "@bitwarden/common/services/system.service";
import { TokenService } from "@bitwarden/common/services/token.service";
import { TotpService } from "@bitwarden/common/services/totp.service";
import { TwoFactorService } from "@bitwarden/common/services/twoFactor.service";
import { UserVerificationService } from "@bitwarden/common/services/userVerification.service";
import { UsernameGenerationService } from "@bitwarden/common/services/usernameGeneration.service";
import { WebCryptoFunctionService } from "@bitwarden/common/services/webCryptoFunction.service";

import { BrowserApi } from "../browser/browserApi";
import { SafariApp } from "../browser/safariApp";
import { Account } from "../models/account";
import { PopupUtilsService } from "../popup/services/popup-utils.service";
import { AutofillService as AutofillServiceAbstraction } from "../services/abstractions/autofill.service";
import { StateService as StateServiceAbstraction } from "../services/abstractions/state.service";
import AutofillService from "../services/autofill.service";
import { BrowserCryptoService } from "../services/browserCrypto.service";
import BrowserLocalStorageService from "../services/browserLocalStorage.service";
import BrowserMessagingService from "../services/browserMessaging.service";
import BrowserMessagingPrivateModeBackgroundService from "../services/browserMessagingPrivateModeBackground.service";
import BrowserPlatformUtilsService from "../services/browserPlatformUtils.service";
import I18nService from "../services/i18n.service";
import { KeyGenerationService } from "../services/keyGeneration.service";
import { LocalBackedSessionStorageService } from "../services/localBackedSessionStorage.service";
import { StateService } from "../services/state.service";
import { VaultFilterService } from "../services/vaultFilter.service";
import VaultTimeoutService from "../services/vaultTimeout.service";

import CommandsBackground from "./commands.background";
import ContextMenusBackground from "./contextMenus.background";
import IdleBackground from "./idle.background";
import IconDetails from "./models/iconDetails";
import { NativeMessagingBackground } from "./nativeMessaging.background";
import NotificationBackground from "./notification.background";
import RuntimeBackground from "./runtime.background";
import TabsBackground from "./tabs.background";
import WebRequestBackground from "./webRequest.background";

export default class MainBackground {
  messagingService: MessagingServiceAbstraction;
  storageService: AbstractStorageService;
  secureStorageService: AbstractStorageService;
  memoryStorageService: AbstractStorageService;
  i18nService: I18nServiceAbstraction;
  platformUtilsService: PlatformUtilsServiceAbstraction;
  logService: LogServiceAbstraction;
  cryptoService: CryptoServiceAbstraction;
  cryptoFunctionService: CryptoFunctionServiceAbstraction;
  tokenService: TokenServiceAbstraction;
  appIdService: AppIdServiceAbstraction;
  apiService: ApiServiceAbstraction;
  environmentService: EnvironmentServiceAbstraction;
  settingsService: SettingsServiceAbstraction;
  cipherService: CipherServiceAbstraction;
  folderService: InternalFolderServiceAbstraction;
  collectionService: CollectionServiceAbstraction;
  vaultTimeoutService: VaultTimeoutServiceAbstraction;
  syncService: SyncServiceAbstraction;
  passwordGenerationService: PasswordGenerationServiceAbstraction;
  totpService: TotpServiceAbstraction;
  autofillService: AutofillServiceAbstraction;
  containerService: ContainerService;
  auditService: AuditServiceAbstraction;
  authService: AuthServiceAbstraction;
  exportService: ExportServiceAbstraction;
  searchService: SearchServiceAbstraction;
  notificationsService: NotificationsServiceAbstraction;
  stateService: StateServiceAbstraction;
  stateMigrationService: StateMigrationService;
  systemService: SystemServiceAbstraction;
  eventService: EventServiceAbstraction;
  policyService: PolicyServiceAbstraction;
  popupUtilsService: PopupUtilsService;
  sendService: SendServiceAbstraction;
  fileUploadService: FileUploadServiceAbstraction;
  organizationService: OrganizationServiceAbstraction;
  providerService: InternalProviderServiceAbstraction;
  keyConnectorService: KeyConnectorServiceAbstraction;
  userVerificationService: UserVerificationServiceAbstraction;
  twoFactorService: TwoFactorServiceAbstraction;
  vaultFilterService: VaultFilterService;
  usernameGenerationService: UsernameGenerationServiceAbstraction;
  encryptService: EncryptService;
  folderApiService: FolderApiServiceAbstraction;

  // Passed to the popup for Safari to workaround issues with theming, downloading, etc.
  backgroundWindow = window;

  onUpdatedRan: boolean;
  onReplacedRan: boolean;
  loginToAutoFill: CipherView = null;

  private commandsBackground: CommandsBackground;
  private contextMenusBackground: ContextMenusBackground;
  private idleBackground: IdleBackground;
  private notificationBackground: NotificationBackground;
  private runtimeBackground: RuntimeBackground;
  private tabsBackground: TabsBackground;
  private webRequestBackground: WebRequestBackground;

  private sidebarAction: any;
  private buildingContextMenu: boolean;
  private menuOptionsLoaded: any[] = [];
  private syncTimeout: any;
  private isSafari: boolean;
  private nativeMessagingBackground: NativeMessagingBackground;

  constructor(public isPrivateMode: boolean = false) {
    // Services
    const lockedCallback = async (userId?: string) => {
      if (this.notificationsService != null) {
        this.notificationsService.updateConnection(false);
      }
      await this.setIcon();
      await this.refreshBadgeAndMenu(true);
      if (this.systemService != null) {
        await this.systemService.clearPendingClipboard();
        await this.reloadProcess();
      }
    };

    const logoutCallback = async (expired: boolean, userId?: string) =>
      await this.logout(expired, userId);

    this.messagingService = isPrivateMode
      ? new BrowserMessagingPrivateModeBackgroundService()
      : new BrowserMessagingService();
    this.logService = new ConsoleLogService(false);
    this.cryptoFunctionService = new WebCryptoFunctionService(window);
    this.storageService = new BrowserLocalStorageService();
    this.secureStorageService = new BrowserLocalStorageService();
    this.memoryStorageService =
      chrome.runtime.getManifest().manifest_version == 3
        ? new LocalBackedSessionStorageService(
            new EncryptService(this.cryptoFunctionService, this.logService, false),
            new KeyGenerationService(this.cryptoFunctionService)
          )
        : new MemoryStorageService();
    this.stateMigrationService = new StateMigrationService(
      this.storageService,
      this.secureStorageService,
      new StateFactory(GlobalState, Account)
    );
    this.stateService = new StateService(
      this.storageService,
      this.secureStorageService,
      this.memoryStorageService,
      this.logService,
      this.stateMigrationService,
      new StateFactory(GlobalState, Account)
    );
    this.platformUtilsService = new BrowserPlatformUtilsService(
      this.messagingService,
      this.stateService,
      (clipboardValue, clearMs) => {
        if (this.systemService != null) {
          this.systemService.clearClipboard(clipboardValue, clearMs);
        }
      },
      async () => {
        if (this.nativeMessagingBackground != null) {
          const promise = this.nativeMessagingBackground.getResponse();

          try {
            await this.nativeMessagingBackground.send({ command: "biometricUnlock" });
          } catch (e) {
            return Promise.reject(e);
          }

          return promise.then((result) => result.response === "unlocked");
        }
      }
    );
    this.i18nService = new I18nService(BrowserApi.getUILanguage(window));
    this.encryptService = new EncryptService(this.cryptoFunctionService, this.logService, true);
    this.cryptoService = new BrowserCryptoService(
      this.cryptoFunctionService,
      this.encryptService,
      this.platformUtilsService,
      this.logService,
      this.stateService
    );
    this.tokenService = new TokenService(this.stateService);
    this.appIdService = new AppIdService(this.storageService);
    this.environmentService = new EnvironmentService(this.stateService);
    this.apiService = new ApiService(
      this.tokenService,
      this.platformUtilsService,
      this.environmentService,
      this.appIdService,
      (expired: boolean) => this.logout(expired)
    );
    this.settingsService = new SettingsService(this.stateService);
    this.fileUploadService = new FileUploadService(this.logService, this.apiService);
    this.cipherService = new CipherService(
      this.cryptoService,
      this.settingsService,
      this.apiService,
      this.fileUploadService,
      this.i18nService,
      () => this.searchService,
      this.logService,
      this.stateService
    );
    this.folderService = new FolderService(
      this.cryptoService,
      this.i18nService,
      this.cipherService,
      this.stateService
    );
    this.folderApiService = new FolderApiService(this.folderService, this.apiService);
    this.collectionService = new CollectionService(
      this.cryptoService,
      this.i18nService,
      this.stateService
    );
    this.searchService = new SearchService(this.cipherService, this.logService, this.i18nService);
    this.sendService = new SendService(
      this.cryptoService,
      this.apiService,
      this.fileUploadService,
      this.i18nService,
      this.cryptoFunctionService,
      this.stateService
    );
    this.organizationService = new OrganizationService(this.stateService);
    this.policyService = new PolicyService(
      this.stateService,
      this.organizationService,
      this.apiService
    );
    this.keyConnectorService = new KeyConnectorService(
      this.stateService,
      this.cryptoService,
      this.apiService,
      this.tokenService,
      this.logService,
      this.organizationService,
      this.cryptoFunctionService,
      logoutCallback
    );
    this.vaultFilterService = new VaultFilterService(
      this.stateService,
      this.organizationService,
      this.folderService,
      this.cipherService,
      this.collectionService,
      this.policyService
    );

    this.twoFactorService = new TwoFactorService(this.i18nService, this.platformUtilsService);

    // eslint-disable-next-line
    const that = this;
    const backgroundMessagingService = new (class extends MessagingServiceAbstraction {
      // AuthService should send the messages to the background not popup.
      send = (subscriber: string, arg: any = {}) => {
        const message = Object.assign({}, { command: subscriber }, arg);
        that.runtimeBackground.processMessage(message, that, null);
      };
    })();
    this.authService = new AuthService(
      this.cryptoService,
      this.apiService,
      this.tokenService,
      this.appIdService,
      this.platformUtilsService,
      backgroundMessagingService,
      this.logService,
      this.keyConnectorService,
      this.environmentService,
      this.stateService,
      this.twoFactorService,
      this.i18nService
    );

    this.vaultTimeoutService = new VaultTimeoutService(
      this.cipherService,
      this.folderService,
      this.collectionService,
      this.cryptoService,
      this.platformUtilsService,
      this.messagingService,
      this.searchService,
      this.tokenService,
      this.policyService,
      this.keyConnectorService,
      this.stateService,
      this.authService,
      lockedCallback,
      logoutCallback
    );
    this.providerService = new ProviderService(this.stateService);
    this.syncService = new SyncService(
      this.apiService,
      this.settingsService,
      this.folderService,
      this.cipherService,
      this.cryptoService,
      this.collectionService,
      this.messagingService,
      this.policyService,
      this.sendService,
      this.logService,
      this.keyConnectorService,
      this.stateService,
      this.organizationService,
      this.providerService,
      this.folderApiService,
      logoutCallback
    );
    this.eventService = new EventService(
      this.apiService,
      this.cipherService,
      this.stateService,
      this.logService,
      this.organizationService
    );
    this.passwordGenerationService = new PasswordGenerationService(
      this.cryptoService,
      this.policyService,
      this.stateService
    );
    this.totpService = new TotpService(this.cryptoFunctionService, this.logService);
    this.autofillService = new AutofillService(
      this.cipherService,
      this.stateService,
      this.totpService,
      this.eventService,
      this.logService
    );
    this.containerService = new ContainerService(this.cryptoService);
    this.auditService = new AuditService(this.cryptoFunctionService, this.apiService);
    this.exportService = new ExportService(
      this.folderService,
      this.cipherService,
      this.apiService,
      this.cryptoService,
      this.cryptoFunctionService
    );
    this.notificationsService = new NotificationsService(
      this.syncService,
      this.appIdService,
      this.apiService,
      this.environmentService,
      logoutCallback,
      this.logService,
      this.stateService,
      this.authService
    );
    this.popupUtilsService = new PopupUtilsService(isPrivateMode);

    this.userVerificationService = new UserVerificationService(
      this.cryptoService,
      this.i18nService,
      this.apiService
    );

    const systemUtilsServiceReloadCallback = () => {
      const forceWindowReload =
        this.platformUtilsService.isSafari() ||
        this.platformUtilsService.isFirefox() ||
        this.platformUtilsService.isOpera();
      BrowserApi.reloadExtension(forceWindowReload ? window : null);
      return Promise.resolve();
    };

    this.systemService = new SystemService(
      this.messagingService,
      this.platformUtilsService,
      systemUtilsServiceReloadCallback,
      this.stateService
    );

    // Other fields
    this.isSafari = this.platformUtilsService.isSafari();
    this.sidebarAction = this.isSafari
      ? null
      : typeof opr !== "undefined" && opr.sidebarAction
      ? opr.sidebarAction
      : (window as any).chrome.sidebarAction;

    // Background
    this.runtimeBackground = new RuntimeBackground(
      this,
      this.autofillService,
      this.platformUtilsService as BrowserPlatformUtilsService,
      this.i18nService,
      this.notificationsService,
      this.systemService,
      this.environmentService,
      this.messagingService,
      this.logService
    );
    this.nativeMessagingBackground = new NativeMessagingBackground(
      this.cryptoService,
      this.cryptoFunctionService,
      this.runtimeBackground,
      this.i18nService,
      this.messagingService,
      this.appIdService,
      this.platformUtilsService,
      this.stateService,
      this.logService,
      this.authService
    );
    this.commandsBackground = new CommandsBackground(
      this,
      this.passwordGenerationService,
      this.platformUtilsService,
      this.vaultTimeoutService,
      this.authService
    );
    this.notificationBackground = new NotificationBackground(
      this.autofillService,
      this.cipherService,
      this.authService,
      this.policyService,
      this.folderService,
      this.stateService
    );

    this.tabsBackground = new TabsBackground(this, this.notificationBackground);
    this.contextMenusBackground = new ContextMenusBackground(
      this,
      this.cipherService,
      this.passwordGenerationService,
      this.platformUtilsService,
      this.authService,
      this.eventService,
      this.totpService
    );
    this.idleBackground = new IdleBackground(
      this.vaultTimeoutService,
      this.stateService,
      this.notificationsService
    );
    this.webRequestBackground = new WebRequestBackground(
      this.platformUtilsService,
      this.cipherService,
      this.authService
    );

    this.usernameGenerationService = new UsernameGenerationService(
      this.cryptoService,
      this.stateService,
      this.apiService
    );
  }

  async bootstrap() {
    this.containerService.attachToGlobal(window);

    await this.stateService.init();

    await (this.vaultTimeoutService as VaultTimeoutService).init(true);
    await (this.i18nService as I18nService).init();
    await (this.eventService as EventService).init(true);
    await this.runtimeBackground.init();
    await this.notificationBackground.init();
    await this.commandsBackground.init();

    this.twoFactorService.init();

    await this.tabsBackground.init();
    await this.contextMenusBackground.init();
    await this.idleBackground.init();
    await this.webRequestBackground.init();

    if (this.platformUtilsService.isFirefox() && !this.isPrivateMode) {
      // Set Private Mode windows to the default icon - they do not share state with the background page
      const privateWindows = await BrowserApi.getPrivateModeWindows();
      privateWindows.forEach(async (win) => {
        await this.actionSetIcon(chrome.browserAction, "", win.id);
        await this.actionSetIcon(this.sidebarAction, "", win.id);
      });

      BrowserApi.onWindowCreated(async (win) => {
        if (win.incognito) {
          await this.actionSetIcon(chrome.browserAction, "", win.id);
          await this.actionSetIcon(this.sidebarAction, "", win.id);
        }
      });
    }

    return new Promise<void>((resolve) => {
      setTimeout(async () => {
        await this.environmentService.setUrlsFromStorage();
        await this.setIcon();
        this.fullSync(true);
        setTimeout(() => this.notificationsService.init(), 2500);
        resolve();
      }, 500);
    });
  }

  async setIcon() {
    if ((!chrome.browserAction && !this.sidebarAction) || this.isPrivateMode) {
      return;
    }

    const authStatus = await this.authService.getAuthStatus();

    let suffix = "";
    if (authStatus === AuthenticationStatus.LoggedOut) {
      suffix = "_gray";
    } else if (authStatus === AuthenticationStatus.Locked) {
      suffix = "_locked";
    }

    await this.actionSetIcon(chrome.browserAction, suffix);
    await this.actionSetIcon(this.sidebarAction, suffix);
  }

  async refreshBadgeAndMenu(forLocked = false) {
    if (!chrome.windows || !chrome.contextMenus) {
      return;
    }

    const menuDisabled = await this.stateService.getDisableContextMenuItem();
    if (!menuDisabled) {
      await this.buildContextMenu();
    } else {
      await this.contextMenusRemoveAll();
    }

    if (forLocked) {
      await this.loadMenuAndUpdateBadgeForNoAccessState(!menuDisabled);
      this.onUpdatedRan = this.onReplacedRan = false;
      return;
    }

    const tab = await BrowserApi.getTabFromCurrentWindow();
    if (tab) {
      await this.contextMenuReady(tab, !menuDisabled);
    }
  }

  async logout(expired: boolean, userId?: string) {
    await this.eventService.uploadEvents(userId);

    await Promise.all([
      this.eventService.clearEvents(userId),
      this.syncService.setLastSync(new Date(0), userId),
      this.cryptoService.clearKeys(userId),
      this.settingsService.clear(userId),
      this.cipherService.clear(userId),
      this.folderService.clear(userId),
      this.collectionService.clear(userId),
      this.policyService.clear(userId),
      this.passwordGenerationService.clear(userId),
      this.vaultTimeoutService.clear(userId),
      this.keyConnectorService.clear(),
      this.vaultFilterService.clear(),
    ]);

    await this.stateService.clean({ userId: userId });

    if (userId == null || userId === (await this.stateService.getUserId())) {
      this.searchService.clearIndex();
      this.messagingService.send("doneLoggingOut", { expired: expired, userId: userId });
    }

    await this.setIcon();
    await this.refreshBadgeAndMenu(true);
    await this.reseedStorage();
    this.notificationsService.updateConnection(false);
    await this.systemService.clearPendingClipboard();
    await this.reloadProcess();
  }

  async collectPageDetailsForContentScript(tab: any, sender: string, frameId: number = null) {
    if (tab == null || !tab.id) {
      return;
    }

    const options: any = {};
    if (frameId != null) {
      options.frameId = frameId;
    }

    BrowserApi.tabSendMessage(
      tab,
      {
        command: "collectPageDetails",
        tab: tab,
        sender: sender,
      },
      options
    );
  }

  async openPopup() {
    // Chrome APIs cannot open popup

    // TODO: Do we need to open this popup?
    if (!this.isSafari) {
      return;
    }
    await SafariApp.sendMessageToApp("showPopover", null, true);
  }

  async reseedStorage() {
    if (
      !this.platformUtilsService.isChrome() &&
      !this.platformUtilsService.isVivaldi() &&
      !this.platformUtilsService.isOpera()
    ) {
      return;
    }

    const currentVaultTimeout = await this.stateService.getVaultTimeout();
    if (currentVaultTimeout == null) {
      return;
    }

    const getStorage = (): Promise<any> =>
      new Promise((resolve) => {
        chrome.storage.local.get(null, (o: any) => resolve(o));
      });

    const clearStorage = (): Promise<void> =>
      new Promise((resolve) => {
        chrome.storage.local.clear(() => resolve());
      });

    const storage = await getStorage();
    await clearStorage();

    for (const key in storage) {
      // eslint-disable-next-line
      if (!storage.hasOwnProperty(key)) {
        continue;
      }
      await this.storageService.save(key, storage[key]);
    }
  }

  private async buildContextMenu() {
    if (!chrome.contextMenus || this.buildingContextMenu) {
      return;
    }

    this.buildingContextMenu = true;
    await this.contextMenusRemoveAll();

    await this.contextMenusCreate({
      type: "normal",
      id: "root",
      contexts: ["all"],
      title: "Bitwarden",
    });

    await this.contextMenusCreate({
      type: "normal",
      id: "autofill",
      parentId: "root",
      contexts: ["all"],
      title: this.i18nService.t("autoFill"),
    });

    await this.contextMenusCreate({
      type: "normal",
      id: "copy-username",
      parentId: "root",
      contexts: ["all"],
      title: this.i18nService.t("copyUsername"),
    });

    await this.contextMenusCreate({
      type: "normal",
      id: "copy-password",
      parentId: "root",
      contexts: ["all"],
      title: this.i18nService.t("copyPassword"),
    });

    if (await this.stateService.getCanAccessPremium()) {
      await this.contextMenusCreate({
        type: "normal",
        id: "copy-totp",
        parentId: "root",
        contexts: ["all"],
        title: this.i18nService.t("copyVerificationCode"),
      });
    }

    await this.contextMenusCreate({
      type: "separator",
      parentId: "root",
    });

    await this.contextMenusCreate({
      type: "normal",
      id: "generate-password",
      parentId: "root",
      contexts: ["all"],
      title: this.i18nService.t("generatePasswordCopied"),
    });

    await this.contextMenusCreate({
      type: "normal",
      id: "copy-identifier",
      parentId: "root",
      contexts: ["all"],
      title: this.i18nService.t("copyElementIdentifier"),
    });

    this.buildingContextMenu = false;
  }

  private async contextMenuReady(tab: any, contextMenuEnabled: boolean) {
    await this.loadMenuAndUpdateBadge(tab.url, tab.id, contextMenuEnabled);
    this.onUpdatedRan = this.onReplacedRan = false;
  }

  private async loadMenuAndUpdateBadge(url: string, tabId: number, contextMenuEnabled: boolean) {
    if (!url || (!chrome.browserAction && !this.sidebarAction)) {
      return;
    }

    this.actionSetBadgeBackgroundColor(chrome.browserAction);
    this.actionSetBadgeBackgroundColor(this.sidebarAction);

    this.menuOptionsLoaded = [];
    const authStatus = await this.authService.getAuthStatus();
    if (authStatus === AuthenticationStatus.Unlocked) {
      try {
        const ciphers = await this.cipherService.getAllDecryptedForUrl(url);
        ciphers.sort((a, b) => this.cipherService.sortCiphersByLastUsedThenName(a, b));

        if (contextMenuEnabled) {
          ciphers.forEach((cipher) => {
            this.loadLoginContextMenuOptions(cipher);
          });
        }

        const disableBadgeCounter = await this.stateService.getDisableBadgeCounter();
        let theText = "";

        if (!disableBadgeCounter) {
          if (ciphers.length > 0 && ciphers.length <= 9) {
            theText = ciphers.length.toString();
          } else if (ciphers.length > 0) {
            theText = "9+";
          }
        }

        if (contextMenuEnabled && ciphers.length === 0) {
          await this.loadNoLoginsContextMenuOptions(this.i18nService.t("noMatchingLogins"));
        }

        this.sidebarActionSetBadgeText(theText, tabId);
        this.browserActionSetBadgeText(theText, tabId);

        return;
      } catch (e) {
        this.logService.error(e);
      }
    }

    await this.loadMenuAndUpdateBadgeForNoAccessState(contextMenuEnabled);
  }

  private async loadMenuAndUpdateBadgeForNoAccessState(contextMenuEnabled: boolean) {
    if (contextMenuEnabled) {
      const authed = await this.stateService.getIsAuthenticated();
      await this.loadNoLoginsContextMenuOptions(
        this.i18nService.t(authed ? "unlockVaultMenu" : "loginToVaultMenu")
      );
    }

    const tabs = await BrowserApi.getActiveTabs();
    if (tabs != null) {
      tabs.forEach((tab) => {
        if (tab.id != null) {
          this.browserActionSetBadgeText("", tab.id);
          this.sidebarActionSetBadgeText("", tab.id);
        }
      });
    }
  }

  private async loadLoginContextMenuOptions(cipher: any) {
    if (
      cipher == null ||
      cipher.type !== CipherType.Login ||
      cipher.reprompt !== CipherRepromptType.None
    ) {
      return;
    }

    let title = cipher.name;
    if (cipher.login.username && cipher.login.username !== "") {
      title += " (" + cipher.login.username + ")";
    }
    await this.loadContextMenuOptions(title, cipher.id, cipher);
  }

  private async loadNoLoginsContextMenuOptions(noLoginsMessage: string) {
    await this.loadContextMenuOptions(noLoginsMessage, "noop", null);
  }

  private async loadContextMenuOptions(title: string, idSuffix: string, cipher: any) {
    if (
      !chrome.contextMenus ||
      this.menuOptionsLoaded.indexOf(idSuffix) > -1 ||
      (cipher != null && cipher.type !== CipherType.Login)
    ) {
      return;
    }

    this.menuOptionsLoaded.push(idSuffix);

    if (cipher == null || (cipher.login.password && cipher.login.password !== "")) {
      await this.contextMenusCreate({
        type: "normal",
        id: "autofill_" + idSuffix,
        parentId: "autofill",
        contexts: ["all"],
        title: this.sanitizeContextMenuTitle(title),
      });
    }

    if (cipher == null || (cipher.login.username && cipher.login.username !== "")) {
      await this.contextMenusCreate({
        type: "normal",
        id: "copy-username_" + idSuffix,
        parentId: "copy-username",
        contexts: ["all"],
        title: this.sanitizeContextMenuTitle(title),
      });
    }

    if (
      cipher == null ||
      (cipher.login.password && cipher.login.password !== "" && cipher.viewPassword)
    ) {
      await this.contextMenusCreate({
        type: "normal",
        id: "copy-password_" + idSuffix,
        parentId: "copy-password",
        contexts: ["all"],
        title: this.sanitizeContextMenuTitle(title),
      });
    }

    const canAccessPremium = await this.stateService.getCanAccessPremium();
    if (canAccessPremium && (cipher == null || (cipher.login.totp && cipher.login.totp !== ""))) {
      await this.contextMenusCreate({
        type: "normal",
        id: "copy-totp_" + idSuffix,
        parentId: "copy-totp",
        contexts: ["all"],
        title: this.sanitizeContextMenuTitle(title),
      });
    }
  }

  private sanitizeContextMenuTitle(title: string): string {
    return title.replace(/&/g, "&&");
  }

  private async fullSync(override = false) {
    const syncInternal = 6 * 60 * 60 * 1000; // 6 hours
    const lastSync = await this.syncService.getLastSync();

    let lastSyncAgo = syncInternal + 1;
    if (lastSync != null) {
      lastSyncAgo = new Date().getTime() - lastSync.getTime();
    }

    if (override || lastSyncAgo >= syncInternal) {
      await this.syncService.fullSync(override);
      this.scheduleNextSync();
    } else {
      this.scheduleNextSync();
    }
  }

  private scheduleNextSync() {
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }

    this.syncTimeout = setTimeout(async () => await this.fullSync(), 5 * 60 * 1000); // check every 5 minutes
  }

  // Browser API Helpers

  private contextMenusRemoveAll() {
    return new Promise<void>((resolve) => {
      chrome.contextMenus.removeAll(() => {
        resolve();
        if (chrome.runtime.lastError) {
          return;
        }
      });
    });
  }

  private contextMenusCreate(options: any) {
    return new Promise<void>((resolve) => {
      chrome.contextMenus.create(options, () => {
        resolve();
        if (chrome.runtime.lastError) {
          return;
        }
      });
    });
  }

  private async actionSetIcon(theAction: any, suffix: string, windowId?: number): Promise<any> {
    if (!theAction || !theAction.setIcon) {
      return;
    }

    const options: IconDetails = {
      path: {
        19: "images/icon19" + suffix + ".png",
        38: "images/icon38" + suffix + ".png",
      },
    };

    if (this.platformUtilsService.isFirefox()) {
      options.windowId = windowId;
      await theAction.setIcon(options);
    } else if (this.platformUtilsService.isSafari()) {
      // Workaround since Safari 14.0.3 returns a pending promise
      // which doesn't resolve within a reasonable time.
      theAction.setIcon(options);
    } else {
      return new Promise<void>((resolve) => {
        theAction.setIcon(options, () => resolve());
      });
    }
  }

  private actionSetBadgeBackgroundColor(action: any) {
    if (action && action.setBadgeBackgroundColor) {
      action.setBadgeBackgroundColor({ color: "#294e5f" });
    }
  }

  private browserActionSetBadgeText(text: string, tabId: number) {
    if (chrome.browserAction && chrome.browserAction.setBadgeText) {
      chrome.browserAction.setBadgeText({
        text: text,
        tabId: tabId,
      });
    }
  }

  private sidebarActionSetBadgeText(text: string, tabId: number) {
    if (!this.sidebarAction) {
      return;
    }

    if (this.sidebarAction.setBadgeText) {
      this.sidebarAction.setBadgeText({
        text: text,
        tabId: tabId,
      });
    } else if (this.sidebarAction.setTitle) {
      let title = "Bitwarden";
      if (text && text !== "") {
        title += " [" + text + "]";
      }

      this.sidebarAction.setTitle({
        title: title,
        tabId: tabId,
      });
    }
  }

  private async reloadProcess(): Promise<void> {
    const accounts = this.stateService.accounts.getValue();
    if (accounts != null) {
      for (const userId of Object.keys(accounts)) {
        if ((await this.authService.getAuthStatus(userId)) === AuthenticationStatus.Unlocked) {
          return;
        }
      }
    }
    await this.systemService.startProcessReload();
  }
}
