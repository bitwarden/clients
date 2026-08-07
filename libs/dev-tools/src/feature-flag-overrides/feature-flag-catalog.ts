import { DefaultFeatureFlagValue, FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";

/** A feature flag that can be driven by an on/off control. */
export type BooleanFeatureFlagOption = {
  /** The enum member name, e.g. `PM32009NewItemTypes`. */
  name: string;
  /** The wire value the server keys the flag by, e.g. `pm-32009-new-item-types`. */
  value: FeatureFlag;
};

/**
 * Every feature flag whose default is a boolean, sorted by name.
 *
 * Restricted to boolean flags because on/off/default is the only control we offer — the handful of
 * numeric flags have no meaningful toggle.
 */
export const BOOLEAN_FEATURE_FLAGS: readonly BooleanFeatureFlagOption[] = Object.entries(
  FeatureFlag,
)
  .filter(([, value]) => typeof DefaultFeatureFlagValue[value as FeatureFlag] === "boolean")
  .map(([name, value]) => ({ name, value: value as FeatureFlag }))
  .sort((a, b) => a.name.localeCompare(b.name));
