import { afterNextRender, inject, Inject, Injectable, Injector, DOCUMENT } from "@angular/core";

import { AbstractThemingService } from "@bitwarden/angular/platform/services/theming/theming.service.abstraction";
import { AutomationDriver } from "@bitwarden/automation-driver";
import { TwoFactorService } from "@bitwarden/common/auth/two-factor";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService as LogServiceAbstraction } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import { IpcService } from "@bitwarden/common/platform/ipc";
import { MigrationRunner } from "@bitwarden/common/platform/services/migration-runner";
import { limitPerformanceMeasurements } from "@bitwarden/logging";

import { ForegroundUnlockService } from "../../key-management/unlock/foreground-unlock.service";
import BrowserPopupUtils from "../../platform/browser/browser-popup-utils";
import { PopupSizeService } from "../../platform/popup/layout/popup-size.service";
import { PopupViewCacheService } from "../../platform/popup/view-cache/popup-view-cache.service";

@Injectable()
export class InitService {
  private sizeService = inject(PopupSizeService);
  private automationDriver = inject(AutomationDriver);
  private readonly injector = inject(Injector);

  /** Guards against scheduling/running the deferred init more than once. */
  private deferredInitScheduled = false;
  private deferredInitStarted = false;

  constructor(
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService,
    private twoFactorService: TwoFactorService,
    private logService: LogServiceAbstraction,
    private themingService: AbstractThemingService,
    private sdkLoadService: SdkLoadService,
    private viewCacheService: PopupViewCacheService,
    private readonly migrationRunner: MigrationRunner,
    private readonly unlockService: ForegroundUnlockService,
    private readonly ipcService: IpcService,
    @Inject(DOCUMENT) private document: Document,
  ) {}

  /**
   * `APP_INITIALIZER` entrypoint for the popup (also used by the sidebar and popout, which share
   * this module).
   *
   * Only render-critical work is awaited here, so Angular can bootstrap and the popup paints as
   * soon as possible after the toolbar icon is clicked. Heavy startup work — loading/instantiating
   * the WASM SDK, opening the IPC channel to the background, and waiting for the background's state
   * migrations — is deferred until after the first render. Previously all of this ran before the
   * first paint, which made the popup take seconds to appear (bitwarden/clients#12286).
   */
  init() {
    return async () => {
      await this.initCriticalForFirstPaint();
      this.scheduleDeferredInit();
    };
  }

  /**
   * Startup work that must complete before the popup's first render: translations, theming and
   * window sizing, the view cache, and cheap listener subscriptions. Each of these is a single
   * local storage read or an in-memory subscription, so they are fast even on slow disks.
   */
  private async initCriticalForFirstPaint() {
    limitPerformanceMeasurements();

    // Subscribe early so unlock announcements from the background are not missed.
    this.unlockService.init();

    await this.i18nService.init();
    this.twoFactorService.init();
    await this.viewCacheService.init();
    await this.sizeService.init();

    this.automationDriver.attachToGlobal(self);

    const htmlEl = window.document.documentElement;
    this.themingService.applyThemeChangesTo(this.document);
    htmlEl.classList.add("locale_" + this.i18nService.translationLocale);

    // Workaround for slow performance on external monitors on Chrome + MacOS
    // See: https://bugs.chromium.org/p/chromium/issues/detail?id=971701#c64
    if (
      this.platformUtilsService.isChrome() &&
      navigator.platform.indexOf("Mac") > -1 &&
      BrowserPopupUtils.inPopup(window) &&
      (window.screenLeft < 0 ||
        window.screenTop < 0 ||
        window.screenLeft > window.screen.width ||
        window.screenTop > window.screen.height)
    ) {
      htmlEl.classList.add("force_redraw");
      this.logService.info("Force redraw is on");
    }
  }

  /**
   * Heavy, non-render-critical startup work, run after the popup's first render:
   *
   * - {@link SdkLoadService.loadAndInit} fetches and instantiates the WASM SDK. Everything that
   *   needs the SDK already awaits `SdkLoadService.Ready` itself, so starting the load here instead
   *   of before the first paint is safe and keeps WASM compilation off the critical path.
   * - {@link IpcService.init} builds the IPC client on top of the SDK and connects the runtime port
   *   to the background (which also wakes the MV3 service worker). Nothing on the first-render path
   *   requires IPC; the background-only shared-unlock peer is the only consumer.
   * - {@link MigrationRunner.waitForCompletion} polls disk storage until the background has
   *   finished running state migrations. On a fresh install or right after an extension update the
   *   background service worker is still cold-starting, and awaiting this before the first render
   *   was a major contributor to the multi-second popup delay.
   */
  async initDeferred() {
    if (this.deferredInitStarted) {
      return;
    }
    this.deferredInitStarted = true;

    try {
      await this.sdkLoadService.loadAndInit();
      await this.ipcService.init();
      // Browser background is responsible for migrations; the IPC port opened above wakes it.
      await this.migrationRunner.waitForCompletion();
    } catch (e) {
      // Deferred init must never break the popup; log and continue.
      this.logService.error("[InitService] Deferred initialization failed", e);
    }
  }

  /**
   * Schedules {@link initDeferred} to run after the next render (i.e. after the popup's first
   * paint) instead of blocking `APP_INITIALIZER` on it.
   */
  private scheduleDeferredInit() {
    if (this.deferredInitScheduled) {
      return;
    }
    this.deferredInitScheduled = true;
    afterNextRender(() => void this.initDeferred(), { injector: this.injector });
  }
}
