import { Page } from "@playwright/test";

import { automationDriver } from "./automation-driver";

/** Keys of `FeatureFlag` (libs/common/src/enums/feature-flag.enum.ts) the suites override. */
export const FeatureFlag = Object.freeze({
  // The SDK prelogin fails while the server config is still unset, before login.
  PasswordPreloginFromSdk: "pm-27060-password-prelogin-from-sdk",
} as const);
export type FeatureFlag = (typeof FeatureFlag)[keyof typeof FeatureFlag];

// Test-side shape of `FeatureFlagsCapability` (libs/automation-driver).
type FeatureFlagsCapability = {
  set(flag: FeatureFlag, value: boolean): Promise<void>;
};

/** Overrides `flags` to off in the client `page` belongs to. Overrides beat the server's config. */
export async function disableFlags(page: Page, flags: FeatureFlag[]) {
  const featureFlags = automationDriver<FeatureFlagsCapability>(page, "featureFlags");

  for (const flag of flags) {
    await featureFlags.set(flag, false);
  }
}
