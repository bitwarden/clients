import { Page } from "@playwright/test";

////
// Thin, typed wrapper over the in-app automation driver
// (`libs/automation-driver`), which is attached to the renderer's global object
// in development builds. Tests call these methods instead of writing
// `page.evaluate` strings, so capability names and argument shapes live here.
////

const DRIVER_GLOBAL = "bitwardenAutomationDriver";

const Capability = Object.freeze({
  AfuMode: "afuMode",
  FeatureFlags: "featureFlags",
  Lock: "lock",
  State: "state",
  Biometrics: "biometrics",
  DesktopNavigation: "desktopNavigation",
} as const);
type Capability = (typeof Capability)[keyof typeof Capability];

/** Mirrors `BiometricsStatus` in `libs/key-management`. */
export const BiometricsStatus = Object.freeze({
  Available: 0,
  UnlockNeeded: 1,
  HardwareUnavailable: 2,
  PlatformUnsupported: 5,
} as const);
export type BiometricsStatus = (typeof BiometricsStatus)[keyof typeof BiometricsStatus];

export type UserLockStatus = {
  userId: string;
  email: string;
  status: string;
};

/** Where a piece of state lives, mirroring the state definition it was declared with. */
export type StateAddress = {
  stateName: string;
  key: string;
  location?: "disk" | "memory";
};

export type PendingBiometricRequest = {
  id: string;
  type: "authenticate" | "unlock";
  userId?: string;
};

type FeatureFlagValue = boolean | number | string;

export class AutomationDriver {
  readonly biometrics: BiometricsTools;

  constructor(private page: Page) {
    this.biometrics = new BiometricsTools((capability, method, args) =>
      this.invoke(capability, method, args),
    );
  }

  /** Override a feature flag for the running client. */
  async setFeatureFlag(flag: string, value: FeatureFlagValue): Promise<void> {
    await this.invoke(Capability.FeatureFlags, "set", [flag, value]);
  }

  /** Read the effective value of a feature flag (override > server config > default). */
  async featureFlag(flag: string): Promise<FeatureFlagValue> {
    return await this.invoke<FeatureFlagValue>(Capability.FeatureFlags, "get", [flag]);
  }

  /** Drop a single feature flag override. */
  async clearFeatureFlag(flag: string): Promise<void> {
    await this.invoke(Capability.FeatureFlags, "clear", [flag]);
  }

  /** Drop every feature flag override. */
  async clearFeatureFlags(): Promise<void> {
    await this.invoke(Capability.FeatureFlags, "clearAll", []);
  }

  /** Lock status of every known account. */
  async listUsers(): Promise<UserLockStatus[]> {
    return await this.invoke<UserLockStatus[]>(Capability.Lock, "listUsers", []);
  }

  /** Reads a user's raw stored state; encrypted values stay encrypted. */
  async readUserState(userId: string, address: StateAddress): Promise<unknown> {
    return await this.invoke(Capability.State, "readUser", [userId, address]);
  }

  /** Opens the settings dialog, as the menubar item does. */
  async openSettings(): Promise<void> {
    await this.invoke(Capability.DesktopNavigation, "openSettings", []);
  }

  /** Locks the active account, as the "Lock now" menubar item does. */
  async lockVault(): Promise<void> {
    await this.invoke(Capability.DesktopNavigation, "lockVault", []);
  }

  /**
   * Drops the active user's in-memory unlock material (ephemeral PIN envelope,
   * ephemeral biometric key, user key), as an app restart does.
   */
  async enterAfuMode(): Promise<void> {
    await this.invoke(Capability.AfuMode, "enter", []);
  }

  private async invoke<T>(capability: Capability, method: string, args: unknown[]): Promise<T> {
    const result = await this.page.evaluate(
      async ([driverGlobal, capabilityName, methodName, methodArgs]) => {
        const driver = (window as unknown as Record<string, DriverGlobal | undefined>)[
          driverGlobal as string
        ];

        if (driver == null) {
          throw new Error(`window.${driverGlobal} is missing; this is not a development build.`);
        }

        const target = driver.get(capabilityName as string);

        if (target == null) {
          throw new Error(
            `Automation capability "${capabilityName}" is not available. Present: ${driver
              .list()
              .join(", ")}`,
          );
        }

        return await target[methodName as string](...(methodArgs as unknown[]));
      },
      [DRIVER_GLOBAL, capability, method, args] as const,
    );

    return result as T;
  }
}

type DriverGlobal = {
  list: () => string[];
  get: (name: string) => Record<string, (...args: unknown[]) => Promise<unknown>> | undefined;
};

type Invoke = <T>(capability: Capability, method: string, args: unknown[]) => Promise<T>;

/** Drives the mocked desktop biometrics service (requires `USE_AUTOMATION_BIOMETRICS`). */
class BiometricsTools {
  constructor(private invoke: Invoke) {}

  /** Set the status the client sees when it asks whether biometrics are usable. */
  async setStatus(status: BiometricsStatus): Promise<void> {
    await this.invoke(Capability.Biometrics, "setStatus", [status]);
  }

  /** Requests queued by the client and waiting for a user response. */
  async listPending(): Promise<PendingBiometricRequest[]> {
    return await this.invoke<PendingBiometricRequest[]>(Capability.Biometrics, "listPending", []);
  }

  /** Approve a queued request by id, or the oldest one when no id is given. */
  async approve(id?: string): Promise<void> {
    await this.invoke(Capability.Biometrics, "approve", id == null ? [] : [id]);
  }

  /** Deny a queued request by id, or the oldest one when no id is given. */
  async deny(id?: string): Promise<void> {
    await this.invoke(Capability.Biometrics, "deny", id == null ? [] : [id]);
  }
}
