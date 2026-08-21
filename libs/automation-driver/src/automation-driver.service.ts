import { AllowedFeatureFlagTypes, FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { GLOBAL_FEATURE_FLAG_OVERRIDES } from "@bitwarden/common/platform/services/config/default-config.service";
import { StateProvider } from "@bitwarden/common/platform/state";
import { FlightRecorder, LogLevel, LogService } from "@bitwarden/logging";

type FeatureFlagOverrides = Record<FeatureFlag, AllowedFeatureFlagTypes>;

/**
 * Timeout, in milliseconds, forced onto every toast once the toast service is hooked. Toasts
 * normally dismiss themselves in a few seconds, which is long enough for an automation run to miss
 * them entirely between a click and a screenshot.
 */
export const AUTOMATION_TOAST_TIMEOUT_MS = 60_000;

export interface LogEntry {
  level: LogLevel;
  message: any;
  params: any[];
}

/**
 * A toast as the application requested it — the original timeout, before the hook overrides it.
 */
export interface ToastEntry {
  message: any;
  title?: any;
  variant?: any;
  timeout?: number;
}

/**
 * Controls the desktop main-process automation biometrics service from the renderer. Kept generic
 * so this (common) file has no dependency on desktop code; the desktop client supplies an
 * implementation that forwards to the main process over IPC.
 */
export interface AutomationBiometricsController {
  /** Set the mocked {@link BiometricsStatus} the automation biometrics service reports. */
  setStatus(status: number): Promise<void>;
  /** List the biometric requests currently awaiting approval. */
  listPending(): Promise<unknown[]>;
  /** Approve a pending request by id, or the oldest pending request when no id is given. */
  approve(id?: string): Promise<void>;
  /** Deny a pending request by id, or the oldest pending request when no id is given. */
  deny(id?: string): Promise<void>;
}

/**
 * Structural view of the Angular `ToastService`. Declared here rather than imported so this
 * (client-agnostic) file keeps no dependency on `@bitwarden/components`; the CLI consumes the
 * driver too and has no Angular.
 */
export interface AutomationToastController {
  showToast(options: ToastEntry): void;
}

/**
 * Optional, client-specific capabilities. Each client wires only what it supports; the universal
 * capabilities (feature flags, messaging) are constructor dependencies that every client has.
 */
export interface AutomationDriverCapabilities {
  /** Trigger a process reload. */
  reloadProcess?: () => Promise<void> | void;
  /** Control biometrics (desktop only). */
  biometrics?: AutomationBiometricsController;
  /** Read SDK flight recorder events (clients with WASM SDK only). */
  flightRecorder?: FlightRecorder;
  /** Log service to hook at startup; every write will also be appended to the log buffer. */
  logService?: LogService;
  /**
   * Toast service to hook at startup (clients with a UI only); every toast will be appended to the
   * toast buffer and shown for {@link AUTOMATION_TOAST_TIMEOUT_MS}.
   */
  toastService?: AutomationToastController;
}

/**
 * A small surface attached to the global object for external automation (E2E tests, manual
 * automation). Mirrors {@link ContainerService.attachToGlobal}, but is only attached when the app
 * is running in dev mode.
 *
 * This does not handle Vault Data: feature flag overrides are non-secret developer settings, and
 * the messaging / reload / biometrics capabilities delegate to existing services.
 */
export class AutomationDriver {
  private logBuffer: LogEntry[] = [];
  private toastBuffer: ToastEntry[] = [];

  constructor(
    private configService: ConfigService,
    private stateProvider: StateProvider,
    private messagingService: MessagingService,
    private capabilities: AutomationDriverCapabilities = {},
  ) {
    if (capabilities.logService != null) {
      this.hookLogService(capabilities.logService);
    }
    if (capabilities.toastService != null) {
      this.hookToastService(capabilities.toastService);
    }
  }

  /**
   * Construct and attach an {@link AutomationDriver} to the global object, but only when the app is
   * running in dev mode. Centralizes the dev gate so each client's attach site is a single call.
   */
  static attachToGlobalIfDev(
    global: any,
    platformUtilsService: PlatformUtilsService,
    configService: ConfigService,
    stateProvider: StateProvider,
    messagingService: MessagingService,
    capabilities: AutomationDriverCapabilities = {},
  ): void {
    if (!platformUtilsService.isDev()) {
      return;
    }
    new AutomationDriver(
      configService,
      stateProvider,
      messagingService,
      capabilities,
    ).attachToGlobal(global);
  }

  attachToGlobal(global: any) {
    if (!global.bitwardenAutomationDriver) {
      global.bitwardenAutomationDriver = this;
    }
  }

  // --- Feature flags ---

  /** Override a feature flag to the given value. */
  async setFeatureFlag(flag: FeatureFlag, value: AllowedFeatureFlagTypes): Promise<void> {
    await this.stateProvider
      .getGlobal(GLOBAL_FEATURE_FLAG_OVERRIDES)
      // The override record is a partial map keyed by flag, despite its full-Record type.
      .update((overrides) => ({ ...overrides, [flag]: value }) as FeatureFlagOverrides);
  }

  /** Remove a single feature flag override, restoring server/default resolution. */
  async clearFeatureFlag(flag: FeatureFlag): Promise<void> {
    await this.stateProvider.getGlobal(GLOBAL_FEATURE_FLAG_OVERRIDES).update((overrides) => {
      const updated = { ...overrides };
      delete updated[flag];
      return updated as FeatureFlagOverrides;
    });
  }

  /** Remove all feature flag overrides. */
  async clearAllFeatureFlagOverrides(): Promise<void> {
    await this.stateProvider
      .getGlobal(GLOBAL_FEATURE_FLAG_OVERRIDES)
      .update(() => ({}) as FeatureFlagOverrides);
  }

  /** Read the current effective value of a feature flag (override > server config > default). */
  async getFeatureFlag(flag: FeatureFlag): Promise<AllowedFeatureFlagTypes> {
    return await this.configService.getFeatureFlag(flag);
  }

  // --- Messaging / menubar ---

  /** Send a message command, e.g. menubar actions handled by the app. */
  sendMessage(command: string, data?: Record<string, unknown>): void {
    this.messagingService.send(command, data);
  }

  /** Desktop only — opens the settings page via the menubar message handler. */
  openSettings(): void {
    this.sendMessage("openSettings");
  }

  // --- Process reload ---

  async reloadProcess(): Promise<void> {
    if (this.capabilities.reloadProcess == null) {
      throw new Error("reloadProcess is not supported on this client.");
    }
    await this.capabilities.reloadProcess();
  }

  // --- Biometrics (desktop) ---

  get biometrics(): AutomationBiometricsController | undefined {
    return this.capabilities.biometrics;
  }

  // --- Flight recorder ---

  get flightRecorder(): FlightRecorder | undefined {
    return this.capabilities.flightRecorder;
  }

  // --- Log service hook ---

  /**
   * Patches `logService.write` so every log call is also appended to an internal buffer.
   * The original `write` still fires — this is additive. Calling this more than once on the
   * same service stacks wrappers; call it once at startup.
   */
  hookLogService(logService: LogService): void {
    const original = logService.write.bind(logService);

    (logService as any).write = (level: LogLevel, message?: any, ...optionalParams: any[]) => {
      // Reads the field on every call so the hook keeps writing to the current buffer after a
      // clear swaps the array out.
      this.logBuffer.push({ level, message, params: optionalParams });
      original(level, message, ...optionalParams);
    };
  }

  /** Return a snapshot of buffered log entries since the last {@link clearLogBuffer} call. */
  readLogBuffer(): LogEntry[] {
    return [...this.logBuffer];
  }

  /** Empty the log buffer. */
  clearLogBuffer(): void {
    this.logBuffer = [];
  }

  // --- Toast service hook ---

  /**
   * Patches `toastService.showToast` so every toast is appended to an internal buffer and shown
   * for {@link AUTOMATION_TOAST_TIMEOUT_MS} instead of its requested timeout — long enough for an
   * automation run to observe and screenshot it. The buffer records the timeout the caller asked
   * for, not the overridden one. The original `showToast` still fires. Calling this more than once
   * on the same service stacks wrappers; call it once at startup.
   */
  hookToastService(toastService: AutomationToastController): void {
    const original = toastService.showToast.bind(toastService);

    (toastService as any).showToast = (options: ToastEntry) => {
      this.toastBuffer.push({ ...options });
      original({ ...options, timeout: AUTOMATION_TOAST_TIMEOUT_MS });
    };
  }

  /** Return a snapshot of buffered toasts since the last {@link clearToastBuffer} call. */
  readToastBuffer(): ToastEntry[] {
    return [...this.toastBuffer];
  }

  /** Empty the toast buffer. */
  clearToastBuffer(): void {
    this.toastBuffer = [];
  }
}
