import { map, Observable } from "rxjs";

import { AllowedFeatureFlagTypes, FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { GLOBAL_FEATURE_FLAG_OVERRIDES } from "@bitwarden/common/platform/services/config/default-config.service";
import { GlobalState, StateProvider } from "@bitwarden/state";

/**
 * The stored shape. `KeyDefinition.record` types the value as a total record, but only overridden
 * flags are actually present — hence the casts below and the partial type consumers see.
 */
type StoredOverrides = Record<FeatureFlag, AllowedFeatureFlagTypes>;

export type FeatureFlagOverrides = Partial<Record<FeatureFlag, AllowedFeatureFlagTypes>>;

/**
 * Reads and writes the local feature flag overrides that `DefaultConfigService` resolves ahead of
 * the server config. Overrides are global — they are not scoped to a user and survive lock, logout
 * and restart.
 *
 * Developer tooling only. Nothing in the shipped product should write overrides.
 */
export class FeatureFlagOverrideService {
  private readonly overrideState: GlobalState<StoredOverrides>;

  /** The currently overridden flags. Flags absent from the record are not overridden. */
  readonly overrides$: Observable<FeatureFlagOverrides>;

  constructor(private readonly stateProvider: StateProvider) {
    this.overrideState = this.stateProvider.getGlobal(GLOBAL_FEATURE_FLAG_OVERRIDES);
    this.overrides$ = this.overrideState.state$.pipe(map((overrides) => overrides ?? {}));
  }

  async setOverride(flag: FeatureFlag, value: AllowedFeatureFlagTypes): Promise<void> {
    await this.overrideState.update(
      (overrides) => ({ ...overrides, [flag]: value }) as StoredOverrides,
    );
  }

  /** Removes the override for a single flag, restoring the server/default value. */
  async clearOverride(flag: FeatureFlag): Promise<void> {
    await this.overrideState.update((overrides) => {
      if (overrides == null || !(flag in overrides)) {
        return overrides;
      }
      // Delete rather than set to null so the stored record does not accumulate dead keys.
      const remaining = { ...overrides };
      delete remaining[flag];
      return remaining;
    });
  }

  async clearAllOverrides(): Promise<void> {
    await this.overrideState.update(() => ({}) as StoredOverrides);
  }
}
