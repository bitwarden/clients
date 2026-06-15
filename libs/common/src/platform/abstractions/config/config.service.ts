// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Observable } from "rxjs";
import { SemVer } from "semver";

import { ServerCommunicationConfig } from "@bitwarden/sdk-internal";

import {
  AllowedFeatureFlagTypes,
  FeatureFlag,
  FeatureFlagValueType,
} from "../../../enums/feature-flag.enum";
import { UserId } from "../../../types/guid";
import { ServerSettings } from "../../models/domain/server-settings";
import { Region } from "../environment.service";

import { ServerConfig } from "./server-config";

export abstract class ConfigService {
  /** The server config of the currently active user */
  serverConfig$: Observable<ServerConfig | null>;
  /**
   * Emits whenever a server config is successfully fetched with the parsed
   * ServerCommunicationConfig. Use this to react to communication config changes
   * without coupling to the config fetch pipeline.
   */
  serverCommunicationConfig$: Observable<ServerCommunicationConfig>;
  /** The server settings of the currently active user */
  serverSettings$: Observable<ServerSettings | null>;
  /** The cloud region of the currently active user */
  cloudRegion$: Observable<Region>;
  /**
   * Emits whether the local feature flag override GUI should be available on this client.
   * True when running in a development build or when explicitly enabled via
   * {@link setLocalFeatureFlagOverrideGuiEnabled} (e.g. `bitwardenContainerService.enableFeatureFlagGui()`).
   */
  localFeatureFlagOverrideGuiEnabled$: Observable<boolean>;
  /**
   * The currently active local feature flag overrides, keyed by flag. Used by the override GUI.
   * An override takes precedence over the server config and default value for that flag.
   */
  featureFlagOverrides$: Observable<Partial<Record<FeatureFlag, AllowedFeatureFlagTypes>>>;
  /**
   * Retrieves the value of a feature flag for the currently active user
   * @param key The feature flag to retrieve
   * @returns An observable that emits the value of the feature flag, updates as the server config changes
   */
  getFeatureFlag$: <Flag extends FeatureFlag>(key: Flag) => Observable<FeatureFlagValueType<Flag>>;

  /**
   * Retrieves the cached feature flag value for a give user. This will NOT call to the server to get
   * the most up to date feature flag.
   * @param key The feature flag key to get the value for.
   * @param userId The user id of the user to get the feature flag value for.
   */
  abstract userCachedFeatureFlag$<Flag extends FeatureFlag>(
    key: Flag,
    userId: UserId,
  ): Observable<FeatureFlagValueType<Flag>>;

  /**
   * Retrieves the value of a feature flag for the currently active user
   * @param key The feature flag to retrieve
   * @returns The value of the feature flag
   */
  getFeatureFlag: <Flag extends FeatureFlag>(key: Flag) => Promise<FeatureFlagValueType<Flag>>;
  /**
   * Verifies whether the server version meets the minimum required version
   * @param minimumRequiredServerVersion The minimum version required
   * @returns True if the server version is greater than or equal to the minimum required version
   */
  checkServerMeetsVersionRequirement$: (
    minimumRequiredServerVersion: SemVer,
  ) => Observable<boolean>;

  /**
   * Triggers a check that the config for the currently active user is up-to-date. If it is not, it will be fetched from the server and stored.
   */
  abstract ensureConfigFetched(): Promise<void>;

  /**
   * Enables or disables the local feature flag override GUI on this client.
   * @param enabled Whether the GUI should be available
   */
  abstract setLocalFeatureFlagOverrideGuiEnabled(enabled: boolean): Promise<void>;

  /**
   * Sets or clears a local override for a feature flag. Overrides apply only to this client and
   * take precedence over the server config and default value.
   * @param flag The feature flag to override
   * @param value The value to force, or null to remove the override (revert to server/default)
   */
  abstract setFeatureFlagOverride<Flag extends FeatureFlag>(
    flag: Flag,
    value: AllowedFeatureFlagTypes | null,
  ): Promise<void>;
}
