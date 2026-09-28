import { expect, Page } from "@playwright/test";

export const AUTOMATION_BIOMETRICS_ENV = { USE_AUTOMATION_BIOMETRICS: "1" };

export const BiometricRequestType = Object.freeze({
  Authenticate: "authenticate",
  Unlock: "unlock",
} as const);
export type BiometricRequestType = (typeof BiometricRequestType)[keyof typeof BiometricRequestType];

export type BiometricRequest = { id: string; type: BiometricRequestType; userId?: string };

const CAPABILITY = "biometrics";
const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Drives the fake biometrics through the renderer's automation driver
 * (libs/automation-driver/src/capabilities/biometrics.ts). Every biometric prompt the app
 * raises waits in the fake until it is approved or denied here.
 */
export class Biometrics {
  constructor(private page: Page) {}

  /** Sets the reported `BiometricsStatus` (libs/key-management), e.g. 0 for Available. */
  async setStatus(status: number) {
    await this.page.evaluate(
      ([name, value]) => (window as any).bitwardenAutomationDriver.get(name).setStatus(value),
      [CAPABILITY, status] as const,
    );
  }

  async listPending(): Promise<BiometricRequest[]> {
    return this.page.evaluate(
      (name) => (window as any).bitwardenAutomationDriver.get(name).listPending(),
      CAPABILITY,
    );
  }

  /** Approves the request with `id`, or every pending request. */
  async approve(id?: string) {
    await this.page.evaluate(
      ([name, requestId]) => (window as any).bitwardenAutomationDriver.get(name).approve(requestId),
      [CAPABILITY, id] as const,
    );
  }

  /** Denies the request with `id`, or every pending request. */
  async deny(id?: string) {
    await this.page.evaluate(
      ([name, requestId]) => (window as any).bitwardenAutomationDriver.get(name).deny(requestId),
      [CAPABILITY, id] as const,
    );
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
