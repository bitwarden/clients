import { DOCUMENT } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";

import { AbstractThemingService } from "@bitwarden/angular/platform/services/theming/theming.service.abstraction";
import { AutomationDriver } from "@bitwarden/automation-driver";
import { TwoFactorService } from "@bitwarden/common/auth/two-factor";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import { IpcService } from "@bitwarden/common/platform/ipc";
import { MigrationRunner } from "@bitwarden/common/platform/services/migration-runner";

import { ForegroundUnlockService } from "../../key-management/unlock/foreground-unlock.service";
import { PopupSizeService } from "../../platform/popup/layout/popup-size.service";
import { PopupViewCacheService } from "../../platform/popup/view-cache/popup-view-cache.service";

import { InitService } from "./init.service";

/**
 * Regression tests for https://github.com/bitwarden/clients/issues/12286: the popup used to block
 * its first paint on heavy startup work (WASM SDK load, IPC setup, waiting for the background's
 * migrations). The `APP_INITIALIZER` returned by {@link InitService.init} must now only await
 * render-critical work and defer the rest until after the first render.
 */
describe("InitService", () => {
  let service: InitService;

  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let i18nService: MockProxy<I18nService>;
  let twoFactorService: MockProxy<TwoFactorService>;
  let logService: MockProxy<LogService>;
  let themingService: MockProxy<AbstractThemingService>;
  let sdkLoadService: MockProxy<SdkLoadService>;
  let viewCacheService: MockProxy<PopupViewCacheService>;
  let migrationRunner: MockProxy<MigrationRunner>;
  let unlockService: MockProxy<ForegroundUnlockService>;
  let ipcService: MockProxy<IpcService>;
  let sizeService: MockProxy<PopupSizeService>;
  let automationDriver: MockProxy<AutomationDriver>;

  /** Lets the deferred init promise chain settle after the render hook fires. */
  const flushAsync = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

  beforeEach(() => {
    platformUtilsService = mock<PlatformUtilsService>();
    platformUtilsService.isChrome.mockReturnValue(false);

    i18nService = mock<I18nService>();
    i18nService.init.mockResolvedValue(undefined);
    i18nService.translationLocale = "en";

    twoFactorService = mock<TwoFactorService>();
    logService = mock<LogService>();
    themingService = mock<AbstractThemingService>();

    sdkLoadService = mock<SdkLoadService>();
    sdkLoadService.loadAndInit.mockResolvedValue(undefined);

    viewCacheService = mock<PopupViewCacheService>();
    viewCacheService.init.mockResolvedValue(undefined);

    migrationRunner = mock<MigrationRunner>();
    migrationRunner.waitForCompletion.mockResolvedValue(undefined);

    unlockService = mock<ForegroundUnlockService>();
    unlockService.init.mockReturnValue({ unsubscribe: jest.fn() } as any);

    ipcService = mock<IpcService>();
    ipcService.init.mockResolvedValue(undefined);

    sizeService = mock<PopupSizeService>();
    sizeService.init.mockResolvedValue(undefined);

    automationDriver = mock<AutomationDriver>();

    TestBed.configureTestingModule({
      providers: [
        InitService,
        { provide: PlatformUtilsService, useValue: platformUtilsService },
        { provide: I18nService, useValue: i18nService },
        { provide: TwoFactorService, useValue: twoFactorService },
        { provide: LogService, useValue: logService },
        { provide: AbstractThemingService, useValue: themingService },
        { provide: SdkLoadService, useValue: sdkLoadService },
        { provide: PopupViewCacheService, useValue: viewCacheService },
        { provide: MigrationRunner, useValue: migrationRunner },
        { provide: ForegroundUnlockService, useValue: unlockService },
        { provide: IpcService, useValue: ipcService },
        { provide: PopupSizeService, useValue: sizeService },
        { provide: AutomationDriver, useValue: automationDriver },
        { provide: DOCUMENT, useValue: document },
      ],
    });

    // InitService uses `inject()` field initializers, so it must be created in an injection context.
    service = TestBed.runInInjectionContext(() => TestBed.inject(InitService));
  });

  describe("init (APP_INITIALIZER)", () => {
    it("awaits render-critical initialization before resolving", async () => {
      await service.init()();

      expect(unlockService.init).toHaveBeenCalledTimes(1);
      expect(i18nService.init).toHaveBeenCalledTimes(1);
      expect(twoFactorService.init).toHaveBeenCalledTimes(1);
      expect(viewCacheService.init).toHaveBeenCalledTimes(1);
      expect(sizeService.init).toHaveBeenCalledTimes(1);
      expect(automationDriver.attachToGlobal).toHaveBeenCalledTimes(1);
      expect(themingService.applyThemeChangesTo).toHaveBeenCalledTimes(1);
      expect(document.documentElement.classList.contains("locale_en")).toBe(true);
    });

    it("does not load the WASM SDK, open IPC, or wait for migrations before the first render", async () => {
      await service.init()();

      expect(sdkLoadService.loadAndInit).not.toHaveBeenCalled();
      expect(ipcService.init).not.toHaveBeenCalled();
      expect(migrationRunner.waitForCompletion).not.toHaveBeenCalled();
    });

    it("runs the deferred init after the first render, in order: SDK load, IPC init, migration wait", async () => {
      const order: string[] = [];
      sdkLoadService.loadAndInit.mockImplementation(async () => {
        order.push("sdk-load");
      });
      ipcService.init.mockImplementation(async () => {
        order.push("ipc-init");
      });
      migrationRunner.waitForCompletion.mockImplementation(async () => {
        order.push("migration-wait");
      });

      await service.init()();
      expect(order).toEqual([]);

      // Simulate the first render completing: ApplicationRef.tick() runs the afterNextRender hooks.
      TestBed.tick();
      await flushAsync();

      expect(order).toEqual(["sdk-load", "ipc-init", "migration-wait"]);
    });

    it("schedules the deferred init only once even if the initializer runs multiple times", async () => {
      await service.init()();
      await service.init()();

      TestBed.tick();
      await flushAsync();

      expect(sdkLoadService.loadAndInit).toHaveBeenCalledTimes(1);
      expect(ipcService.init).toHaveBeenCalledTimes(1);
      expect(migrationRunner.waitForCompletion).toHaveBeenCalledTimes(1);
    });
  });

  describe("initDeferred", () => {
    it("is idempotent", async () => {
      await service.initDeferred();
      await service.initDeferred();

      expect(sdkLoadService.loadAndInit).toHaveBeenCalledTimes(1);
      expect(ipcService.init).toHaveBeenCalledTimes(1);
      expect(migrationRunner.waitForCompletion).toHaveBeenCalledTimes(1);
    });

    it("logs but does not throw when deferred initialization fails", async () => {
      sdkLoadService.loadAndInit.mockRejectedValue(new Error("wasm failed to load"));

      await expect(service.initDeferred()).resolves.toBeUndefined();

      expect(logService.error).toHaveBeenCalledWith(
        "[InitService] Deferred initialization failed",
        expect.any(Error),
      );
      // The failing step short-circuits the chain; the popup itself is unaffected.
      expect(ipcService.init).not.toHaveBeenCalled();
    });
  });
});
