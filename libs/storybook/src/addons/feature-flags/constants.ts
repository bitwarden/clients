/**
 * Shared, dependency-free constants for the feature-flags Storybook addon.
 *
 * This file must not import from `@bitwarden/*` so it can be safely bundled into
 * BOTH the preview (iframe) and the manager (Storybook UI shell), which use
 * different builders. The manager bundle in particular cannot resolve the
 * `@bitwarden/*` path aliases.
 */

export const ADDON_ID = "bitwarden/feature-flags";
export const PANEL_ID = `${ADDON_ID}/panel`;

/** Global holding the list of currently-enabled feature flag keys. */
export const FEATURE_FLAGS_GLOBAL = "bwEnabledFeatureFlags";

/**
 * Global holding the full catalog of toggleable flags. Seeded by the preview
 * (which can read the enum) via `initialGlobals` and read by the manager panel.
 * Globals sync across the preview/manager boundary, so the panel never needs to
 * import the flag enum itself.
 */
export const FEATURE_FLAGS_CATALOG_GLOBAL = "bwFeatureFlagCatalog";

export type FeatureFlagOption = { name: string; value: string };

/**
 * Builds a story-level `globals` override that enables the given flag(s) (and
 * only those) for a single story. Use it to define distinct stories with
 * different flag states — the override takes precedence over the panel:
 *
 * ```ts
 * export const FlagOn = { globals: enabledFlags(FeatureFlag.Foobar) };
 * export const FlagOff = { globals: enabledFlags() };
 * ```
 */
export function enabledFlags(...flags: string[]) {
  return { [FEATURE_FLAGS_GLOBAL]: flags };
}

/**
 * Builds a Chromatic `modes` map that snapshots a single story with the given
 * flag(s) off and then on. Opt in per-story:
 *
 * ```ts
 * export const Default = {
 *   parameters: { chromatic: { modes: featureFlagModes(FeatureFlag.Foobar) } },
 * };
 * ```
 */
export function featureFlagModes(...flags: string[]) {
  return {
    "flag off": enabledFlags(),
    "flag on": enabledFlags(...flags),
  };
}
