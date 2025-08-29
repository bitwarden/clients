// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import "core-js/proposals/explicit-resource-management";

import * as path from "path";

import { app } from "electron";
import { Subject, firstValueFrom } from "rxjs";

import { SsoUrlService } from "@bitwarden/auth/common";
import { AccountServiceImplementation } from "@bitwarden/common/auth/services/account.service";
import { DefaultActiveUserAccessor } from "@bitwarden/common/auth/services/default-active-user.accessor";
import { ClientType } from "@bitwarden/common/enums";
import { EncryptServiceImplementation } from "@bitwarden/common/key-management/crypto/services/encrypt.service.implementation";
import { RegionConfig } from "@bitwarden/common/platform/abstractions/environment.service";
import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import { Message, MessageSender } from "@bitwarden/common/platform/messaging";
// eslint-disable-next-line no-restricted-imports -- For dependency creation
import { SubjectMessageSender } from "@bitwarden/common/platform/messaging/internal";
import { DefaultEnvironmentService } from "@bitwarden/common/platform/services/default-environment.service";
import { MemoryStorageService } from "@bitwarden/common/platform/services/memory-storage.service";
import { MigrationBuilderService } from "@bitwarden/common/platform/services/migration-builder.service";
import { MigrationRunner } from "@bitwarden/common/platform/services/migration-runner";
import { DefaultBiometricStateService } from "@bitwarden/key-management";
import { NodeCryptoFunctionService } from "@bitwarden/node/services/node-crypto-function.service";
import {
  DefaultActiveUserStateProvider,
  DefaultDerivedStateProvider,
  DefaultGlobalStateProvider,
  DefaultSingleUserStateProvider,
  DefaultStateEventRegistrarService,
  DefaultStateProvider,
} from "@bitwarden/state-internal";
import { SerializedMemoryStorageService, StorageServiceProvider } from "@bitwarden/storage-core";

import { ChromiumImporterService } from "./app/tools/import/chromium-importer.service";
import { MainDesktopAutotypeService } from "./autofill/main/main-desktop-autotype.service";
import { MainSshAgentService } from "./autofill/main/main-ssh-agent.service";
import { DesktopAutofillSettingsService } from "./autofill/services/desktop-autofill-settings.service";
import { DesktopBiometricsService } from "./key-management/biometrics/desktop.biometrics.service";
import { MainBiometricsIPCListener } from "./key-management/biometrics/main-biometrics-ipc.listener";
import { MainBiometricsService } from "./key-management/biometrics/main-biometrics.service";
import { MenuMain } from "./main/menu/menu.main";
import { MessagingMain } from "./main/messaging.main";
import { NativeMessagingMain } from "./main/native-messaging.main";
import { PowerMonitorMain } from "./main/power-monitor.main";
import { TrayMain } from "./main/tray.main";
import { UpdaterMain } from "./main/updater.main";
import { WindowMain } from "./main/window.main";
import { NativeAutofillMain } from "./platform/main/autofill/native-autofill.main";
import { ClipboardMain } from "./platform/main/clipboard.main";
import { DesktopCredentialStorageListener } from "./platform/main/desktop-credential-storage-listener";
import { VersionMain } from "./platform/main/version.main";
import { DesktopSettingsService } from "./platform/services/desktop-settings.service";
import { ElectronLogMainService } from "./platform/services/electron-log.main.service";
import { ElectronStorageService } from "./platform/services/electron-storage.service";
import { EphemeralValueStorageService } from "./platform/services/ephemeral-value-storage.main.service";
import { I18nMainService } from "./platform/services/i18n.main.service";
import { SSOLocalhostCallbackService } from "./platform/services/sso-localhost-callback.service";
import { ElectronMainMessagingService } from "./services/electron-main-messaging.service";
import { MainSdkLoadService } from "./services/main-sdk-load-service";
import { isMacAppStore } from "./utils";

export class Main {
  logService: ElectronLogMainService;
  i18nService: I18nMainService;
  storageService: ElectronStorageService;
  memoryStorageService: MemoryStorageService;
  memoryStorageForStateProviders: SerializedMemoryStorageService;
  messagingService: MessageSender;
  environmentService: DefaultEnvironmentService;
  desktopCredentialStorageListener: DesktopCredentialStorageListener;
  mainBiometricsIpcListener: MainBiometricsIPCListener;
  desktopSettingsService: DesktopSettingsService;
  mainCryptoFunctionService: NodeCryptoFunctionService;
  migrationRunner: MigrationRunner;
  ssoUrlService: SsoUrlService;

  windowMain: WindowMain;
  messagingMain: MessagingMain;
  updaterMain: UpdaterMain;
  menuMain: MenuMain;
  powerMonitorMain: PowerMonitorMain;
  trayMain: TrayMain;
  biometricsService: DesktopBiometricsService;
  nativeMessagingMain: NativeMessagingMain;
  clipboardMain: ClipboardMain;
  nativeAutofillMain: NativeAutofillMain;
  desktopAutofillSettingsService: DesktopAutofillSettingsService;
  versionMain: VersionMain;
  sshAgentService: MainSshAgentService;
  sdkLoadService: SdkLoadService;
  mainDesktopAutotypeService: MainDesktopAutotypeService;

  constructor() {
    // Set paths for portable builds
    let appDataPath = null;
    if (process.env.BITWARDEN_APPDATA_DIR != null) {
      appDataPath = process.env.BITWARDEN_APPDATA_DIR;
    } else if (process.platform === "win32" && process.env.PORTABLE_EXECUTABLE_DIR != null) {
      appDataPath = path.join(process.env.PORTABLE_EXECUTABLE_DIR, "bitwarden-appdata");
    } else if (process.platform === "linux" && process.env.SNAP_USER_DATA != null) {
      appDataPath = path.join(process.env.SNAP_USER_DATA, "appdata");
    }

    // Workaround for bug described here: https://github.com/electron/electron/issues/46538
    if (process.platform === "linux") {
      app.commandLine.appendSwitch("gtk-version", "3");
    }

    app.on("ready", () => {
      // on ready stuff...
    });

    if (appDataPath != null) {
      app.setPath("userData", appDataPath);
    }
    app.setPath("logs", path.join(app.getPath("userData"), "logs"));

    const args = process.argv.slice(1);
    const watch = args.some((val) => val === "--watch");

    if (watch) {
      const execName = process.platform === "win32" ? "electron.cmd" : "electron";
      // eslint-disable-next-line
      require("electron-reload")(__dirname, {
        electron: path.join(__dirname, "../../../", "node_modules", ".bin", execName),
        electronArgv: ["--inspect=5858", "--watch"],
      });
    }

    this.logService = new ElectronLogMainService(null, app.getPath("userData"));

    const storageDefaults: any = {};
    this.storageService = new ElectronStorageService(app.getPath("userData"), storageDefaults);
    this.memoryStorageService = new MemoryStorageService();
    this.memoryStorageForStateProviders = new SerializedMemoryStorageService();
    const storageServiceProvider = new StorageServiceProvider(
      this.storageService,
      this.memoryStorageForStateProviders,
    );
    const globalStateProvider = new DefaultGlobalStateProvider(
      storageServiceProvider,
      this.logService,
    );

    this.i18nService = new I18nMainService("en", "./locales/", globalStateProvider);

    this.sdkLoadService = new MainSdkLoadService();

    this.mainCryptoFunctionService = new NodeCryptoFunctionService();

    const stateEventRegistrarService = new DefaultStateEventRegistrarService(
      globalStateProvider,
      storageServiceProvider,
    );

    const singleUserStateProvider = new DefaultSingleUserStateProvider(
      storageServiceProvider,
      stateEventRegistrarService,
      this.logService,
    );

    const accountService = new AccountServiceImplementation(
      MessageSender.EMPTY,
      this.logService,
      globalStateProvider,
      singleUserStateProvider,
    );

    const activeUserStateProvider = new DefaultActiveUserStateProvider(
      new DefaultActiveUserAccessor(accountService),
      singleUserStateProvider,
    );

    const stateProvider = new DefaultStateProvider(
      activeUserStateProvider,
      singleUserStateProvider,
      globalStateProvider,
      new DefaultDerivedStateProvider(),
    );

    this.environmentService = new DefaultEnvironmentService(
      stateProvider,
      accountService,
      process.env.ADDITIONAL_REGIONS as unknown as RegionConfig[],
    );

    this.migrationRunner = new MigrationRunner(
      this.storageService,
      this.logService,
      new MigrationBuilderService(),
      ClientType.Desktop,
    );

    this.desktopSettingsService = new DesktopSettingsService(stateProvider);
    const biometricStateService = new DefaultBiometricStateService(stateProvider);
    const encryptService = new EncryptServiceImplementation(
      this.mainCryptoFunctionService,
      this.logService,
      true,
    );

    this.windowMain = new WindowMain(
      biometricStateService,
      this.logService,
      this.storageService,
      this.desktopSettingsService,
      (arg) => this.processDeepLink(arg),
      (win) => this.trayMain.setupWindowListeners(win),
    );

    this.biometricsService = new MainBiometricsService(
      this.i18nService,
      this.windowMain,
      this.logService,
      process.platform,
      biometricStateService,
      encryptService,
      this.mainCryptoFunctionService,
    );

    this.messagingMain = new MessagingMain(this, this.desktopSettingsService);
    this.updaterMain = new UpdaterMain(this.i18nService, this.windowMain);

    const messageSubject = new Subject<Message<Record<string, unknown>>>();
    this.messagingService = MessageSender.combine(
      new SubjectMessageSender(messageSubject), // For local messages
      new ElectronMainMessagingService(this.windowMain),
    );

    this.trayMain = new TrayMain(
      this.windowMain,
      this.i18nService,
      this.desktopSettingsService,
      this.messagingService,
      this.biometricsService,
    );

    messageSubject.asObservable().subscribe((message) => {
      void this.messagingMain.onMessage(message).catch((err) => {
        this.logService.error(
          "Error while handling message",
          message?.command ?? "Unknown command",
          err,
        );
      });
    });

    this.versionMain = new VersionMain(this.windowMain);

    this.powerMonitorMain = new PowerMonitorMain(this.messagingService, this.logService);
    this.menuMain = new MenuMain(
      this.i18nService,
      this.messagingService,
      this.environmentService,
      this.windowMain,
      this.updaterMain,
      this.desktopSettingsService,
      this.versionMain,
    );

    this.trayMain = new TrayMain(
      this.windowMain,
      this.i18nService,
      this.desktopSettingsService,
      this.messagingService,
      this.biometricsService,
    );

    this.desktopCredentialStorageListener = new DesktopCredentialStorageListener(
      "Bitwarden",
      this.logService,
    );
    this.mainBiometricsIpcListener = new MainBiometricsIPCListener(
      this.biometricsService,
      this.logService,
    );

    this.nativeMessagingMain = new NativeMessagingMain(
      this.logService,
      this.windowMain,
      app.getPath("userData"),
      app.getPath("exe"),
      app.getAppPath(),
    );

    this.desktopAutofillSettingsService = new DesktopAutofillSettingsService(stateProvider);

    this.clipboardMain = new ClipboardMain();
    this.clipboardMain.init();

    this.sshAgentService = new MainSshAgentService(this.logService, this.messagingService);

    new EphemeralValueStorageService();

    this.ssoUrlService = new SsoUrlService();
    new SSOLocalhostCallbackService(
      this.environmentService,
      this.messagingService,
      this.ssoUrlService,
    );

    new ChromiumImporterService();

    this.nativeAutofillMain = new NativeAutofillMain(this.logService, this.windowMain);
    void this.nativeAutofillMain.init();

    this.mainDesktopAutotypeService = new MainDesktopAutotypeService(
      this.logService,
      this.windowMain,
    );

    app
      .whenReady()
      .then(() => {
        this.mainDesktopAutotypeService.init();
      })
      .catch((reason) => {
        this.logService.error("Error initializing Autotype.", reason);
      });

    app.on("will-quit", () => {
      this.mainDesktopAutotypeService.disableAutotype();
    });
  }

  bootstrap() {
    this.desktopCredentialStorageListener.init();
    this.mainBiometricsIpcListener.init();
    // Run migrations first, then other things
    this.migrationRunner.run().then(
      async () => {
        await this.toggleHardwareAcceleration();
        // Reset modal mode to make sure main window is displayed correctly
        await this.desktopSettingsService.resetModalMode();
        await this.windowMain.init();
        await this.i18nService.init();
        await this.messagingMain.init();
        // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.menuMain.init();
        await this.trayMain.init("Bitwarden", [
          {
            label: this.i18nService.t("lockVault"),
            enabled: false,
            id: "lockVault",
            click: () => this.messagingService.send("lockVault"),
          },
        ]);
        if (await firstValueFrom(this.desktopSettingsService.startToTray$)) {
          await this.trayMain.hideToTray();
        }
        this.powerMonitorMain.init();
        await this.updaterMain.init();

        const [browserIntegrationEnabled, ddgIntegrationEnabled] = await Promise.all([
          firstValueFrom(this.desktopSettingsService.browserIntegrationEnabled$),
          firstValueFrom(this.desktopAutofillSettingsService.enableDuckDuckGoBrowserIntegration$),
        ]);

        if (browserIntegrationEnabled || ddgIntegrationEnabled) {
          // Re-register the native messaging host integrations on startup, in case they are not present
          if (browserIntegrationEnabled) {
            this.nativeMessagingMain
              .generateManifests()
              .catch((err) => this.logService.error("Error while generating manifests", err));
          }
          if (ddgIntegrationEnabled) {
            this.nativeMessagingMain
              .generateDdgManifests()
              .catch((err) => this.logService.error("Error while generating DDG manifests", err));
          }

          this.nativeMessagingMain
            .listen()
            .catch((err) =>
              this.logService.error("Error while starting native message listener", err),
            );
        }

        app.removeAsDefaultProtocolClient("bitwarden");
        if (process.env.NODE_ENV === "development" && process.platform === "win32") {
          // Fix development build on Windows requirering a different protocol client
          app.setAsDefaultProtocolClient("bitwarden", process.execPath, [
            process.argv[1],
            path.resolve(process.argv[2]),
          ]);
        } else {
          app.setAsDefaultProtocolClient("bitwarden");
        }

        // Process protocol for macOS
        app.on("open-url", (event, url) => {
          event.preventDefault();
          this.processDeepLink([url]);
        });

        // Handle window visibility events
        this.windowMain.win.on("hide", () => {
          this.messagingService.send("windowHidden");
        });
        this.windowMain.win.on("minimize", () => {
          this.messagingService.send("windowHidden");
        });

        await this.sdkLoadService.loadAndInit();
      },
      (e: any) => {
        this.logService.error("Error while running migrations:", e);
      },
    );
  }

  private processDeepLink(argv: string[]): void {
    argv
      .filter((s) => s.indexOf("bitwarden://") === 0)
      .forEach((s) => {
        this.messagingService.send("deepLink", { urlString: s });
      });
  }

  private async toggleHardwareAcceleration(): Promise<void> {
    const hardwareAcceleration = await firstValueFrom(
      this.desktopSettingsService.hardwareAcceleration$,
    );

    if (!hardwareAcceleration || process.env.ELECTRON_DISABLE_GPU) {
      this.logService.warning("Hardware acceleration is disabled");
      app.disableHardwareAcceleration();
    } else if (isMacAppStore()) {
      // We disable hardware acceleration on Mac App Store builds for iMacs with amd switchable GPUs due to:
      // https://github.com/electron/electron/issues/41346
      const gpuInfo: any = await app.getGPUInfo("basic");
      const badGpu = gpuInfo?.auxAttributes?.amdSwitchable ?? false;
      const isImac = gpuInfo?.machineModelName == "iMac";

      if (isImac && badGpu) {
        this.logService.warning(
          "Bad GPU detected, hardware acceleration is disabled for compatibility",
        );
        app.disableHardwareAcceleration();
      }
    }
  }
}
