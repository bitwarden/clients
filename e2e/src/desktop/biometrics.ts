import { expect, Page } from "@playwright/test";

import { AutomationDriver } from "../automation-driver";

export const AUTOMATION_BIOMETRICS_ENV = { USE_AUTOMATION_BIOMETRICS: "1" };

export const BiometricRequestType = Object.freeze({
  Authenticate: "authenticate",
  Unlock: "unlock",
} as const);
export type BiometricRequestType = (typeof BiometricRequestType)[keyof typeof BiometricRequestType];

export type BiometricRequest = { id: string; type: BiometricRequestType; userId?: string };

const CAPABILITY = "biometrics";
const STATE_CAPABILITY = "state";
const REQUEST_TIMEOUT_MS = 15_000;
const ENROLL_TIMEOUT_MS = 15_000;

// `BiometricsStatus.Available` (libs/key-management): for a user, the key is stored.
const STATUS_AVAILABLE = 0;
// `ACCOUNT_ACTIVE_ACCOUNT_ID` (libs/common/src/auth/services/account.service.ts).
const ACTIVE_ACCOUNT_ID = { stateName: "account", key: "activeAccountId" };

// Test-side shapes of `BiometricsCapability` and `StateCapability` (libs/automation-driver).
type BiometricsCapability = {
  setStatus(status: number): Promise<void>;
  listPending(): Promise<BiometricRequest[]>;
  approve(id?: string): Promise<void>;
  deny(id?: string): Promise<void>;
};
type StateCapability = {
  readGlobal(address: typeof ACTIVE_ACCOUNT_ID): Promise<unknown>;
};

/**
 * Drives the fake biometrics through the renderer's automation driver
 * (libs/automation-driver/src/capabilities/biometrics.ts). Every biometric prompt the app
 * raises waits in the fake until it is approved or denied here.
 */
export class Biometrics {
  private biometrics: AutomationDriver<BiometricsCapability>;
  private state: AutomationDriver<StateCapability>;

  constructor(private page: Page) {
    this.biometrics = new AutomationDriver(page, CAPABILITY);
    this.state = new AutomationDriver(page, STATE_CAPABILITY);
  }

  /** Sets the reported `BiometricsStatus` (libs/key-management), e.g. 0 for Available. */
  async setStatus(status: number) {
    await this.biometrics.call("setStatus", status);
  }

  async listPending(): Promise<BiometricRequest[]> {
    return this.biometrics.call("listPending");
  }

  /** Approves the request with `id`, or every pending request. */
  async approve(id?: string) {
    await this.biometrics.call("approve", id);
  }

  /** Denies the request with `id`, or every pending request. */
  async deny(id?: string) {
    await this.biometrics.call("deny", id);
  }

  /**
   * Waits until the active user's key is stored. The settings toggle checks at once, but
   * enrolling finishes asynchronously; locking before that makes it fail silently.
   */
  async waitUntilEnrolled() {
    const userId = await this.state.call("readGlobal", ACTIVE_ACCOUNT_ID);

    await expect
      .poll(
        () =>
          this.page.evaluate(
            (id) => (window as any).ipc.keyManagement.biometric.getBiometricsStatusForUser(id),
            userId,
          ),
        { timeout: ENROLL_TIMEOUT_MS, message: "Biometric enrollment did not complete" },
      )
      .toBe(STATUS_AVAILABLE);
  }

  /** Waits for the app to raise a prompt of `type`, then approves it, like a user touching the sensor. */
  async approveNext(type: BiometricRequestType) {
    let request: BiometricRequest | undefined;

    await expect
      .poll(
        async () => {
          request = (await this.listPending()).find((r) => r.type === type);
          return request != null;
        },
        { timeout: REQUEST_TIMEOUT_MS },
      )
      .toBe(true);

    await this.approve(request!.id);
  }
}
