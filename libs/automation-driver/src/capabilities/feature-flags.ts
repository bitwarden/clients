import { AllowedFeatureFlagTypes, FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { GLOBAL_FEATURE_FLAG_OVERRIDES } from "@bitwarden/common/platform/services/config/default-config.service";
import { StateProvider } from "@bitwarden/common/platform/state";

import { AutomationCapability } from "../automation-capability";

type FeatureFlagOverrides = Record<FeatureFlag, AllowedFeatureFlagTypes>;

/** Reads and overrides feature flags. Available on every client. */
export class FeatureFlagsCapability extends AutomationCapability {
  readonly automationName = "featureFlags";

  constructor(
    private configService: ConfigService,
    private stateProvider: StateProvider,
  ) {
    super();
  }

  /** Override a feature flag to the given value. */
  async set(flag: FeatureFlag, value: AllowedFeatureFlagTypes): Promise<void> {
    await this.stateProvider
      .getGlobal(GLOBAL_FEATURE_FLAG_OVERRIDES)
      // The override record is a partial map keyed by flag, despite its full-Record type.
      .update((overrides) => ({ ...overrides, [flag]: value }) as FeatureFlagOverrides);
  }

  /** Remove a single feature flag override, restoring server/default resolution. */
  async clear(flag: FeatureFlag): Promise<void> {
    await this.stateProvider.getGlobal(GLOBAL_FEATURE_FLAG_OVERRIDES).update((overrides) => {
      const updated = { ...overrides };
      delete updated[flag];
      return updated as FeatureFlagOverrides;
    });
  }

  /** Remove all feature flag overrides. */
  async clearAll(): Promise<void> {
    await this.stateProvider
      .getGlobal(GLOBAL_FEATURE_FLAG_OVERRIDES)
      .update(() => ({}) as FeatureFlagOverrides);
  }

  /** Read the current effective value of a feature flag (override > server config > default). */
  async get(flag: FeatureFlag): Promise<AllowedFeatureFlagTypes> {
    return await this.configService.getFeatureFlag(flag);
  }
}
