import { expect, Page } from "@playwright/test";

import { automationDriver, RemoteCapability } from "../automation-driver";
import { desktopWebAuthnClientFlag, setFlag } from "../feature-flags";
import { GetRequest, GetResponse, SoftwareAuthenticator } from "../webauthn/software-authenticator";

import { test as desktopTest } from "./fixtures";

const AUTOMATION_WEBAUTHN_ENV = { USE_AUTOMATION_WEBAUTHN: "1" };

const CAPABILITY = "webauthn";
const REQUEST_TIMEOUT_MS = 30_000;

/** A request waiting in the app's automation WebAuthn client (apps/desktop/src/auth/webauthn). */
export type DesktopWebAuthnRequest = GetRequest & {
  id: string;
  userVerification?: string;
  timeout?: number;
  appId?: string;
};

// Test-side shape of `WebAuthnCapability` (libs/automation-driver).
type WebAuthnCapability = {
  listPending(): Promise<DesktopWebAuthnRequest[]>;
  respond(id: string, response: GetResponse): Promise<boolean>;
  reject(id: string, error: { name: string; message: string }): Promise<boolean>;
};

/**
 * Answers the desktop app's WebAuthn requests in place of the platform's passkey prompt, through
 * the renderer's automation driver. Requests wait in the app until they're answered here.
 */
export class DesktopWebAuthn {
  private webauthn: RemoteCapability<WebAuthnCapability>;

  constructor(private window: Page) {
    this.webauthn = automationDriver(window, CAPABILITY);
  }

  /** Turns on the desktop WebAuthn client for this platform, or off. */
  async setEnabled(enabled: boolean) {
    await setFlag(this.window, desktopWebAuthnClientFlag(), enabled);
  }

  /** Waits for the app to make a request, as if the platform's passkey prompt had opened. */
  async waitForRequest(): Promise<DesktopWebAuthnRequest> {
    let request: DesktopWebAuthnRequest | undefined;
    await expect
      .poll(
        async () => {
          [request] = await this.webauthn.listPending();
          return request != null;
        },
        { timeout: REQUEST_TIMEOUT_MS, message: "The app never made a WebAuthn request" },
      )
      .toBe(true);
    return request!;
  }

  /** Answers the next request with an assertion from `authenticator`, like a user approving it. */
  async approveNext(authenticator: SoftwareAuthenticator): Promise<DesktopWebAuthnRequest> {
    const request = await this.waitForRequest();
    expect(await this.webauthn.respond(request.id, authenticator.get(request))).toBe(true);
    return request;
  }

  /** Fails the next request with `NotAllowedError`, like a user cancelling the prompt. */
  async cancelNext(): Promise<DesktopWebAuthnRequest> {
    const request = await this.waitForRequest();
    expect(
      await this.webauthn.reject(request.id, {
        name: "NotAllowedError",
        message: "The operation either timed out or was not allowed.",
      }),
    ).toBe(true);
    return request;
  }
}

/**
 * Desktop `test` with the automation WebAuthn client answering in place of the platform's passkey
 * APIs, and a {@link DesktopWebAuthn} driving it.
 */
export const test = desktopTest.extend<{ webauthn: DesktopWebAuthn }>({
  extraEnv: async ({ extraEnv }, use) => {
    await use({ ...extraEnv, ...AUTOMATION_WEBAUTHN_ENV });
  },
  webauthn: async ({ window }, use) => {
    await use(new DesktopWebAuthn(window));
  },
});
