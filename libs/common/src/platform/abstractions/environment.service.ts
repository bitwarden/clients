import { Observable } from "rxjs";

import { UserId } from "../../types/guid";

export type Urls = {
  base?: string;
  webVault?: string;
  api?: string;
  identity?: string;
  icons?: string;
  notifications?: string;
  events?: string;
  keyConnector?: string;
  scim?: string;
};

/**
 * A subset of available regions, additional regions can be loaded through configuration.
 */
// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum Region {
  US = "US",
  EU = "EU",
  SelfHosted = "Self-hosted",
}

/**
 * The possible cloud regions.
 */
export type CloudRegion = Exclude<Region, Region.SelfHosted>;

export type RegionConfig = {
  // Beware this isn't completely true, it's actually a string for custom environments,
  // which are currently only supported in web where it doesn't matter.
  key: Region;
  domain: string;
  urls: Urls;
};

/**
 * The Environment interface represents a server environment.
 *
 * It provides methods to retrieve the URLs of the different services.
 */
export interface Environment {
  /**
   * Retrieve the current region.
   */
  getRegion(): Region;
  /**
   * Retrieve the urls, should only be used when configuring the environment.
   */
  getUrls(): Urls;

  /**
   * Identify if the region is a cloud environment.
   *
   * @returns true if the environment is a cloud environment, false otherwise.
   */
  isCloud(): boolean;

  /**
   * Identify if the region is a self-hosted environment.
   *
   * @returns true if the environment is self-hosted, false otherwise.
   */
  isSelfHosted(): boolean;

  /**
   * Identify if the environment is a production environment.
   *
   * @returns true if the environment is production, false otherwise.
   */
  isProduction(): boolean;

  getApiUrl(): string;
  getEventsUrl(): string;
  getIconsUrl(): string;
  getIdentityUrl(): string;

  /**
   * @deprecated This is currently only used by the CLI. This functionality should be extracted since
   * the CLI relies on changing environment mid-login.
   *
   * @remarks
   * Expect this to be null unless the CLI has explicitly set it during the login flow.
   */
  getKeyConnectorUrl(): string | null;
  getNotificationsUrl(): string;
  getScimUrl(): string;
  getSendUrl(): string;
  getWebVaultUrl(): string;

  /**
   * Get a friendly hostname for the environment.
   *
   * - For self-hosted this is the web vault url without protocol prefix.
   * - For cloud environments it's the domain key.
   */
  getHostname(): string;

  // Not sure why we provide this, evaluate if we can remove it.
  hasBaseUrl(): boolean;
}

/**
 * The environment service. Provides access to set the current environment urls and region.
 */
export abstract class EnvironmentService {
  abstract environment$: Observable<Environment>;

  /**
   * The environment stored in global state, when a user signs in the state stored here will become
   * their user environment.
   */
  abstract globalEnvironment$: Observable<Environment>;

  abstract cloudWebVaultUrl$: Observable<string>;

  /**
   * Retrieve all the available regions for environment selectors.
   *
   * This currently relies on compile time provided constants, and will not change at runtime.
   * Expect all builds to include production environments, QA builds to also include QA
   * environments and dev builds to include localhost.
   */
  abstract availableRegions(): RegionConfig[];

  /**
   * Set the global environment.
   */
  abstract setEnvironment(region: Region, urls?: Urls): Promise<Urls>;

  /**
   * Seed the environment state for a given user based on the global environment.
   *
   * @remarks
   * Expected to be called only by the StateService when adding a new account.
   */
  abstract seedUserEnvironment(userId: UserId): Promise<void>;

  /**
   * Sets the URL of the cloud web vault app based on the region parameter.
   *
   * @param userId - The user id to set the cloud web vault app URL for. If null or undefined the global environment is set.
   * @param region - The region of the cloud web vault app.
   */
  abstract setCloudRegion(userId: UserId | null, region: Region): Promise<void>;

  /**
   * Get the environment from state. Useful if you need to get the environment for another user.
   */
  abstract getEnvironment$(userId: UserId): Observable<Environment>;

  /**
   * @deprecated Use {@link getEnvironment$} instead.
   */
  abstract getEnvironment(userId?: string): Promise<Environment | undefined>;
}
