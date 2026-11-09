import { Page } from "@playwright/test";

import { automationDriver } from "./automation-driver";

/** Keys of `FeatureFlag` (libs/common/src/enums/feature-flag.enum.ts) the suites turn on. */
export const FeatureFlag = Object.freeze({
  SharedUnlock: "innovation-sprint-shared-unlock-part-2",
  // Registers the web ↔ extension IPC content script; read once when the extension starts.
  ContentScriptIpc: "content-script-ipc-channel-framework",
  BiometricsSdkIpc: "biometrics-sdk-ipc",
  // The redesigned vault, whose onboarding opens dialogs and the side nav on its own after login.
  VFO1Foundation: "vfo1-foundation",
} as const);
export type FeatureFlag = (typeof FeatureFlag)[keyof typeof FeatureFlag];

// Test-side shape of `FeatureFlagsCapability` (libs/automation-driver).
type FeatureFlagsCapability = {
  set(flag: FeatureFlag, value: boolean): Promise<void>;
};

/** Overrides `flags` to on in the client `page` belongs to. Overrides beat the server's config. */
export async function enableFlags(page: Page, flags: FeatureFlag[]) {
  const featureFlags = automationDriver<FeatureFlagsCapability>(page, "featureFlags");

  for (const flag of flags) {
    await featureFlags.set(flag, true);
  }
}

/** Overrides `flags` to off in the client `page` belongs to. */
export async function disableFlags(page: Page, flags: FeatureFlag[]) {
  const featureFlags = automationDriver<FeatureFlagsCapability>(page, "featureFlags");

  for (const flag of flags) {
    await featureFlags.set(flag, false);
  }
}
