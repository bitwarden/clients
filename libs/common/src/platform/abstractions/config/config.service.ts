// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Observable } from "rxjs";
import { SemVer } from "semver";

import { FeatureFlag, FeatureFlagValueType } from "../../../enums/feature-flag.enum";
import { UserId } from "../../../types/guid";
import { ServerSettings } from "../../models/domain/server-settings";
import { Region } from "../environment.service";

import { ServerConfig } from "./server-config";

export abstract class ConfigService {
  /** The server config of the currently active user */
  serverConfig$: Observable<ServerConfig | null>;
  /** The server settings of the currently active user */
  serverSettings$: Observable<ServerSettings | null>;
  /** The cloud region of the currently active user */
  cloudRegion$: Observable<Region>;
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
}
