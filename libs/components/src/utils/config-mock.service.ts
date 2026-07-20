import { Observable, of } from "rxjs";

import { FeatureFlag, FeatureFlagValueType } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

/**
 * Minimal {@link ConfigService} stand-in for Storybook stories that render components which read
 * feature flags. Flags default to `false`; pass overrides to the constructor to enable specific
 * flags for a story.
 */
export class StorybookConfigService implements Partial<ConfigService> {
  constructor(private readonly flags: Partial<Record<FeatureFlag, unknown>> = {}) {}

  getFeatureFlag$<Flag extends FeatureFlag>(key: Flag): Observable<FeatureFlagValueType<Flag>> {
    return of((this.flags[key] ?? false) as FeatureFlagValueType<Flag>);
  }
}
