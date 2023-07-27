import * as path from "path";

import { app } from "electron";

import { StateFactory } from "@bitwarden/common/platform/factories/state-factory";
import { GlobalState } from "@bitwarden/common/platform/models/domain/global-state";
import { MemoryStorageService } from "@bitwarden/common/platform/services/memory-storage.service";

import { MenuMain } from "./main/menu/menu.main";
import { MessagingMain } from "./main/messaging.main";
import { NativeMessagingMain } from "./main/native-messaging.main";
import { PowerMonitorMain } from "./main/power-monitor.main";
import { TrayMain } from "./main/tray.main";
import { UpdaterMain } from "./main/updater.main";
import { WindowMain } from "./main/window.main";
import { Account } from "./models/account";
import { BiometricsService, BiometricsServiceAbstraction } from "./platform/main/biometric/index";
import { DesktopCredentialStorageListener } from "./platform/main/desktop-credential-storage-listener";
import { ElectronLogService } from "./platform/services/electron-log.service";
import { ElectronStateService } from "./platform/services/electron-state.service";
import { ElectronStorageService } from "./platform/services/electron-storage.service";
import { I18nService } from "./platform/services/i18n.service";
import { ElectronMainMessagingService } from "./services/electron-main-messaging.service";

export class Main {
  logService: ElectronLogService;
  i18nService: I18nService;
  storageService: ElectronStorageService;
  memoryStorageService: MemoryStorageService;
  messagingService: ElectronMainMessagingService;
  stateService: ElectronStateService;
  desktopCredentialStorageListener: DesktopCredentialStorageListener;

  windowMain: WindowMain;
  messagingMain: MessagingMain;
  updaterMain: UpdaterMain;
  menuMain: MenuMain;
  powerMonitorMain: PowerMonitorMain;
  trayMain: TrayMain;
  biometricsService: BiometricsServiceAbstraction;
  nativeMessagingMain: NativeMessagingMain;

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

    this.logService = new ElectronLogService(null, app.getPath("userData"));
    this.i18nService = new I18nService("en", "./locales/");

    const storageDefaults: any = {};
    // Default vault timeout to "on restart", and action to "lock"
    storageDefaults["global.vaultTimeout"] = -1;
    storageDefaults["global.vaultTimeoutAction"] = "lock";
    this.storageService = new ElectronStorageService(app.getPath("userData"), storageDefaults);
    this.memoryStorageService = new MemoryStorageService();

    // TODO: this state service will have access to on disk storage, but not in memory storage.
    // If we could get this to work using the stateService singleton that the rest of the app uses we could save
    // ourselves from some hacks, like having to manually update the app menu vs. the menu subscribing to events.
    this.stateService = new ElectronStateService(
      this.storageService,
      null,
      this.memoryStorageService,
      this.logService,
      null,
      new StateFactory(GlobalState, Account),
      false // Do not use disk caching because this will get out of sync with the renderer service
    );

    this.windowMain = new WindowMain(
      this.stateService,
      this.logService,
      (arg) => this.processDeepLink(arg),
      (win) => this.trayMain.setupWindowListeners(win)
    );
    this.messagingMain = new MessagingMain(this, this.stateService);
    this.updaterMain = new UpdaterMain(this.i18nService, this.windowMain);
    this.trayMain = new TrayMain(this.windowMain, this.i18nService, this.stateService);

    this.messagingService = new ElectronMainMessagingService(this.windowMain, (message) => {
      this.messagingMain.onMessage(message);
    });
    this.powerMonitorMain = new PowerMonitorMain(this.messagingService);
    this.menuMain = new MenuMain(
      this.i18nService,
      this.messagingService,
      this.stateService,
      this.windowMain,
      this.updaterMain
    );

    this.biometricsService = new BiometricsService(
      this.i18nService,
      this.windowMain,
      this.stateService,
      this.logService,
      this.messagingService,
      process.platform
    );

    this.desktopCredentialStorageListener = new DesktopCredentialStorageListener(
      "Bitwarden",
      this.biometricsService,
      this.logService
    );

    this.nativeMessagingMain = new NativeMessagingMain(
      this.logService,
      this.windowMain,
      app.getPath("userData"),
      app.getPath("exe")
    );
  }

  bootstrap() {
    this.desktopCredentialStorageListener.init();
    this.windowMain.init().then(
      async () => {
        const locale = await this.stateService.getLocale();
        await this.i18nService.init(locale != null ? locale : app.getLocale());
        this.messagingMain.init();
        this.menuMain.init();
        await this.trayMain.init("Bitwarden - Usteam", [
          {
            label: this.i18nService.t("lockVault"),
            enabled: false,
            id: "lockVault",
            click: () => this.messagingService.send("lockVault"),
          },
        ]);
        if (await this.stateService.getEnableStartToTray()) {
          this.trayMain.hideToTray();
        }
        this.powerMonitorMain.init();
        await this.updaterMain.init();
        if (this.biometricsService != null) {
          await this.biometricsService.init();
        }

        if (
          (await this.stateService.getEnableBrowserIntegration()) ||
          (await this.stateService.getEnableDuckDuckGoBrowserIntegration())
        ) {
          this.nativeMessagingMain.listen();
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
      },
      (e: any) => {
        // eslint-disable-next-line
        console.error(e);
      }
    );
  }

  private processDeepLink(argv: string[]): void {
    argv
      .filter((s) => s.indexOf("bitwarden://") === 0)
      .forEach((s) => {
        const url = new URL(s);
        const code = url.searchParams.get("code");
        const receivedState = url.searchParams.get("state");
        if (code != null && receivedState != null) {
          this.messagingService.send("ssoCallback", { code: code, state: receivedState });
        }
      });
  }
}
