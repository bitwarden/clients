import { Observable } from "rxjs";
import { SemVer } from "semver";

import { FeatureFlag } from "../../../enums/feature-flag.enum";
import { Region } from "../environment.service";

import { ServerConfig } from "./server-config";

export abstract class ConfigService {
  /** The server config of the currently active user */
  serverConfig$: Observable<ServerConfig | null>;
  /** The cloud region of the currently active user */
  cloudRegion$: Observable<Region>;
  /**
   * Retrieves the value of a feature flag for the currently active user
   * @param key The feature flag to retrieve
   * @param defaultValue The default value to return if the feature flag is not set or the server's config is irretrievable
   * @returns An observable that emits the value of the feature flag, updates as the server config changes
   */
  getFeatureFlag$: <T extends boolean | number | string>(
    key: FeatureFlag,
    defaultValue?: T,
  ) => Observable<T>;
  /**
   * Retrieves the value of a feature flag for the currently active user
   * @param key The feature flag to retrieve
   * @param defaultValue The default value to return if the feature flag is not set or the server's config is irretrievable
   * @returns The value of the feature flag
   */
  getFeatureFlag: <T extends boolean | number | string>(
    key: FeatureFlag,
    defaultValue?: T,
  ) => Promise<T>;
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
