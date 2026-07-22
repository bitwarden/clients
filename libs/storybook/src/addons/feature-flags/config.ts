/**
 * Preview-side (iframe) wiring for the feature-flags addon.
 *
 * Runs in the preview bundle, which resolves `@bitwarden/*` aliases, so it can
 * read the flag enum directly. It provides a mock `ConfigService` whose flag
 * values are driven by the `FEATURE_FLAGS_GLOBAL` Storybook global.
 */
import { Decorator } from "@storybook/angular";
import { BehaviorSubject, distinctUntilChanged, map, Observable } from "rxjs";

import {
  DefaultFeatureFlagValue,
  FeatureFlag,
  FeatureFlagValueType,
} from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import { FEATURE_FLAGS_GLOBAL, FeatureFlagOption } from "./constants";

/**
 * The set of enabled flags, driven by the panel via the decorator. Held in a
 * subject (rather than baked into the mock at construction) so `getFeatureFlag$`
 * consumers update live — Storybook re-renders on a globals change but does not
 * re-bootstrap the Angular app, so a per-render provider would be ignored.
 */
const enabledFlags$ = new BehaviorSubject<ReadonlySet<string>>(new Set());

/**
 * A mock `ConfigService` reporting the enabled flags as `true` and every other
 * flag at its default value.
 */
class StorybookConfigService implements Partial<ConfigService> {
  getFeatureFlag$ = <Flag extends FeatureFlag>(key: Flag): Observable<FeatureFlagValueType<Flag>> =>
    enabledFlags$.pipe(
      map((enabled) => this.valueFor(key, enabled)),
      distinctUntilChanged(),
    );

  getFeatureFlag = <Flag extends FeatureFlag>(key: Flag): Promise<FeatureFlagValueType<Flag>> =>
    Promise.resolve(this.valueFor(key, enabledFlags$.value));

  private valueFor<Flag extends FeatureFlag>(
    key: Flag,
    enabled: ReadonlySet<string>,
  ): FeatureFlagValueType<Flag> {
    if (enabled.has(key)) {
      // The panel only toggles boolean flags, so "enabled" always means `true`.
      return true as FeatureFlagValueType<Flag>;
    }
    // Cast needed because indexing by a generic `Flag` widens to the union of
    // all flag value types rather than narrowing to `FeatureFlagValueType<Flag>`.
    return DefaultFeatureFlagValue[key] as FeatureFlagValueType<Flag>;
  }
}

const configService = new StorybookConfigService();

/**
 * The catalog of toggleable flags, seeded into globals for the manager panel.
 * Restricted to boolean flags — the only ones a checkbox can meaningfully drive.
 */
export const FEATURE_FLAG_CATALOG: FeatureFlagOption[] = Object.entries(FeatureFlag)
  .filter(([, value]) => typeof DefaultFeatureFlagValue[value as FeatureFlag] === "boolean")
  .map(([name, value]) => ({ name, value: value as string }))
  .sort((a, b) => a.name.localeCompare(b.name));

/**
 * Provides the flag-driven mock `ConfigService` at the application root of every
 * story and syncs the enabled set from globals on each render.
 *
 * A story that provides its own `ConfigService` is left untouched: one provided
 * via `moduleMetadata` sits in a child injector and shadows this one, while one
 * provided at the application root (`applicationConfig`) is detected here and we
 * skip adding ours — adding a second would clash (e.g. Angular refuses to mix a
 * `multi` provider with a regular one for the same token).
 */
export const featureFlagDecorator: Decorator = (storyFn, context) => {
  const enabled = (context.globals[FEATURE_FLAGS_GLOBAL] as string[] | undefined) ?? [];
  enabledFlags$.next(new Set(enabled));
  const story = storyFn();
  const providers = story.applicationConfig?.providers ?? [];
  const storyProvidesConfig = providers.some(
    (p) =>
      p != null &&
      typeof p === "object" &&
      "provide" in p &&
      (p as { provide: unknown }).provide === ConfigService,
  );
  return {
    ...story,
    applicationConfig: {
      ...story.applicationConfig,
      providers: storyProvidesConfig
        ? providers
        : [{ provide: ConfigService, useValue: configService }, ...providers],
    },
  };
};
