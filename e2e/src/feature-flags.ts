import { Page } from "@playwright/test";

import { automationDriver } from "./automation-driver";

/** Keys of `FeatureFlag` (libs/common/src/enums/feature-flag.enum.ts) the suites turn on. */
export const FeatureFlag = Object.freeze({
  SharedUnlock: "innovation-sprint-shared-unlock-part-2",
  // Registers the web ↔ extension IPC content script; read once when the extension starts.
  ContentScriptIpc: "content-script-ipc-channel-framework",
  BiometricsSdkIpc: "biometrics-sdk-ipc",
  // The desktop WebAuthn client: passkey login, passkey unlock and WebAuthn 2FA, per platform.
  DesktopWebAuthnClientWindows: "pm-46060-desktop-webauthn-client-windows",
  DesktopWebAuthnClientMacOs: "pm-46059-desktop-webauthn-client-macos",
  DesktopWebAuthnClientLinux: "pm-46061-desktop-webauthn-client-linux",
} as const);
export type FeatureFlag = (typeof FeatureFlag)[keyof typeof FeatureFlag];

// Test-side shape of `FeatureFlagsCapability` (libs/automation-driver).
type FeatureFlagsCapability = {
  set(flag: FeatureFlag, value: boolean): Promise<void>;
};

/** The desktop WebAuthn client's flag for the platform the tests run on. */
export function desktopWebAuthnClientFlag(): FeatureFlag {
  switch (process.platform) {
    case "win32":
      return FeatureFlag.DesktopWebAuthnClientWindows;
    case "darwin":
      return FeatureFlag.DesktopWebAuthnClientMacOs;
    default:
      return FeatureFlag.DesktopWebAuthnClientLinux;
  }
}

/** Overrides `flag` to `value` in the client `page` belongs to. Overrides beat the server's config. */
export async function setFlag(page: Page, flag: FeatureFlag, value: boolean) {
  await automationDriver<FeatureFlagsCapability>(page, "featureFlags").set(flag, value);
}

/** Overrides `flags` to on in the client `page` belongs to. Overrides beat the server's config. */
export async function enableFlags(page: Page, flags: FeatureFlag[]) {
  const featureFlags = automationDriver<FeatureFlagsCapability>(page, "featureFlags");

  for (const flag of flags) {
    await featureFlags.set(flag, true);
  }
}
