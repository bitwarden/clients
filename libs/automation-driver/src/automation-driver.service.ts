import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { StateProvider } from "@bitwarden/common/platform/state";
import { FlightRecorder } from "@bitwarden/logging";
import { StorageServiceProvider } from "@bitwarden/storage-core";
import { LockService, UnlockService } from "@bitwarden/unlock";

import {
  AutomationBiometricsController,
  AutomationToastController,
  DesktopNavigationCapability,
  FeatureFlagsCapability,
  LockCapability,
  LoggingCapability,
  ProcessReloadCapability,
  ReloadProcess,
  SdkDebugCapability,
  StateCapability,
  ToastCapability,
} from "./capabilities";

/**
 * A small surface attached to the global object for external automation (E2E tests, manual
 * automation). Mirrors {@link ContainerService.attachToGlobal}.
 */
export class AutomationDriver {
  private readonly featureFlagsCapability: FeatureFlagsCapability;
  private readonly stateCapability: StateCapability;
  private readonly processReloadCapability?: ProcessReloadCapability;
  private readonly loggingCapability?: LoggingCapability;
  private readonly desktopNavigationCapability?: DesktopNavigationCapability;
  private readonly lockCapability: LockCapability;
  private readonly toastCapability?: ToastCapability;
  private readonly sdkDebugCapability?: SdkDebugCapability;

  /**
   * Every parameter is required. The `undefined`-able ones are capabilities not every client
   * supports — pass `undefined` there to leave the capability off.
   *
   * @param flightRecorder - `undefined` on clients without the WASM SDK.
   * @param reloadProcess - `undefined` on clients that cannot reload themselves.
   * @param biometricsController - Desktop only.
   * @param messagingService - Desktop only; backs menubar navigation.
   * @param toastService - `undefined` on clients without a UI.
   * @param sdkService - `undefined` on clients without the WASM SDK; enables the debug
   *   capabilities. Trailing and optional so existing call sites need not change.
   */
  constructor(
    configService: ConfigService,
    stateProvider: StateProvider,
    storageServiceProvider: StorageServiceProvider,
    flightRecorder: FlightRecorder | undefined,
    accountService: AccountService,
    authService: AuthService,
    lockService: LockService,
    unlockService: UnlockService,
    reloadProcess: ReloadProcess | undefined,
    private biometricsController: AutomationBiometricsController | undefined,
    messagingService: MessagingService | undefined,
    toastService: AutomationToastController | undefined,
    sdkService?: SdkService,
  ) {
    this.featureFlagsCapability = new FeatureFlagsCapability(configService, stateProvider);
    this.stateCapability = new StateCapability(storageServiceProvider);

    if (flightRecorder != null) {
      this.loggingCapability = new LoggingCapability(flightRecorder);
    }

    if (reloadProcess != null) {
      this.processReloadCapability = new ProcessReloadCapability(reloadProcess);
    }

    if (messagingService != null) {
      this.desktopNavigationCapability = new DesktopNavigationCapability(messagingService);
    }

    if (toastService != null) {
      this.toastCapability = new ToastCapability(toastService);
    }

    if (sdkService != null) {
      this.sdkDebugCapability = new SdkDebugCapability(sdkService);
    }

    this.lockCapability = new LockCapability(
      accountService,
      authService,
      lockService,
      unlockService,
    );
  }

  /** Construct an {@link AutomationDriver} and attach it to the global object. */
  static attachToGlobal(
    global: any,
    configService: ConfigService,
    stateProvider: StateProvider,
    storageServiceProvider: StorageServiceProvider,
    flightRecorder: FlightRecorder | undefined,
    accountService: AccountService,
    authService: AuthService,
    lockService: LockService,
    unlockService: UnlockService,
    reloadProcess: ReloadProcess | undefined,
    biometrics: AutomationBiometricsController | undefined,
    messagingService: MessagingService | undefined,
    toastService: AutomationToastController | undefined,
    sdkService?: SdkService,
  ): void {
    new AutomationDriver(
      configService,
      stateProvider,
      storageServiceProvider,
      flightRecorder,
      accountService,
      authService,
      lockService,
      unlockService,
      reloadProcess,
      biometrics,
      messagingService,
      toastService,
      sdkService,
    ).attachToGlobal(global);
  }

  attachToGlobal(global: any) {
    if (!global.bitwardenAutomationDriver) {
      global.bitwardenAutomationDriver = this;
    }
  }

  // --- Capabilities ---

  get featureFlags(): FeatureFlagsCapability {
    return this.featureFlagsCapability;
  }

  get processReload(): ProcessReloadCapability | undefined {
    return this.processReloadCapability;
  }

  get biometrics(): AutomationBiometricsController | undefined {
    return this.biometricsController;
  }

  get logging(): LoggingCapability | undefined {
    return this.loggingCapability;
  }

  get desktopNavigation(): DesktopNavigationCapability | undefined {
    return this.desktopNavigationCapability;
  }

  get lock(): LockCapability {
    return this.lockCapability;
  }

  get state(): StateCapability {
    return this.stateCapability;
  }

  get toast(): ToastCapability | undefined {
    return this.toastCapability;
  }

  get debug(): SdkDebugCapability | undefined {
    return this.sdkDebugCapability;
  }
}
