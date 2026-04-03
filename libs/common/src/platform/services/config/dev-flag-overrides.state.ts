import { AllowedFeatureFlagTypes } from "../../../enums/feature-flag.enum";
import { DEV_SETTINGS_DISK, KeyDefinition } from "../../state";

/**
 * Global state for developer overrides of feature flag values.
 * Only read/written when the environment is "development".
 * Maps feature flag string values to override values.
 */
export const DEV_FEATURE_FLAG_OVERRIDES = new KeyDefinition<
  Record<string, AllowedFeatureFlagTypes>
>(DEV_SETTINGS_DISK, "featureFlagOverrides", {
  deserializer: (obj) => obj,
});
