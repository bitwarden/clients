// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { distinctUntilChanged, firstValueFrom, map, Observable, switchMap } from "rxjs";
import { Jsonify } from "type-fest";

import { AccountService } from "../../auth/abstractions/account.service";
import { UserId } from "../../types/guid";
import {
  EnvironmentService,
  Environment,
  Region,
  RegionConfig,
  Urls,
  CloudRegion,
} from "../abstractions/environment.service";
import { Utils } from "../misc/utils";
import {
  ENVIRONMENT_DISK,
  ENVIRONMENT_MEMORY,
  GlobalState,
  KeyDefinition,
  StateProvider,
  UserKeyDefinition,
} from "../state";

export class EnvironmentUrls {
  base: string = null;
  api: string = null;
  identity: string = null;
  icons: string = null;
  notifications: string = null;
  events: string = null;
  webVault: string = null;
  keyConnector: string = null;
}

class EnvironmentState {
  region: Region;
  urls: EnvironmentUrls;

  static fromJSON(obj: Jsonify<EnvironmentState>): EnvironmentState {
    return Object.assign(new EnvironmentState(), obj);
  }
}

export const GLOBAL_ENVIRONMENT_KEY = new KeyDefinition<EnvironmentState>(
  ENVIRONMENT_DISK,
  "environment",
  {
    deserializer: EnvironmentState.fromJSON,
  },
);

export const USER_ENVIRONMENT_KEY = new UserKeyDefinition<EnvironmentState>(
  ENVIRONMENT_DISK,
  "environment",
  {
    deserializer: EnvironmentState.fromJSON,
    clearOn: ["logout"],
  },
);

export const GLOBAL_CLOUD_REGION_KEY = new KeyDefinition<CloudRegion>(
  ENVIRONMENT_MEMORY,
  "cloudRegion",
  {
    deserializer: (b) => b,
  },
);

export const USER_CLOUD_REGION_KEY = new UserKeyDefinition<CloudRegion>(
  ENVIRONMENT_MEMORY,
  "cloudRegion",
  {
    deserializer: (b) => b,
    clearOn: ["logout"],
  },
);

/**
 * The production regions available for selection.
 *
 * In the future we desire to load these urls from the config endpoint.
 */
export const PRODUCTION_REGIONS: RegionConfig[] = [
  {
    key: Region.US,
    domain: "bitwarden.com",
    urls: {
      base: null,
      api: "https://api.bitwarden.com",
      identity: "https://identity.bitwarden.com",
      icons: "https://icons.bitwarden.net",
      webVault: "https://vault.bitwarden.com",
      notifications: "https://notifications.bitwarden.com",
      events: "https://events.bitwarden.com",
      scim: "https://scim.bitwarden.com",
    },
  },
  {
    key: Region.EU,
    domain: "bitwarden.eu",
    urls: {
      base: null,
      api: "https://api.bitwarden.eu",
      identity: "https://identity.bitwarden.eu",
      icons: "https://icons.bitwarden.eu",
      webVault: "https://vault.bitwarden.eu",
      notifications: "https://notifications.bitwarden.eu",
      events: "https://events.bitwarden.eu",
      scim: "https://scim.bitwarden.eu",
    },
  },
];

/**
 * The default region when starting the app.
 */
const DEFAULT_REGION = Region.US;

/**
 * The default region configuration.
 */
const DEFAULT_REGION_CONFIG = PRODUCTION_REGIONS.find((r) => r.key === DEFAULT_REGION);

export class DefaultEnvironmentService implements EnvironmentService {
  private globalState: GlobalState<EnvironmentState | null>;
  private globalCloudRegionState: GlobalState<CloudRegion | null>;

  // We intentionally don't want the helper on account service, we want the null back if there is no active user
  private activeAccountId$: Observable<UserId | null> = this.accountService.activeAccount$.pipe(
    map((a) => a?.id),
  );

  environment$: Observable<Environment>;
  cloudWebVaultUrl$: Observable<string>;

  constructor(
    private stateProvider: StateProvider,
    private accountService: AccountService,
    private additionalRegionConfigs: RegionConfig[] = [],
  ) {
    this.globalState = this.stateProvider.getGlobal(GLOBAL_ENVIRONMENT_KEY);
    this.globalCloudRegionState = this.stateProvider.getGlobal(GLOBAL_CLOUD_REGION_KEY);

    const account$ = this.activeAccountId$.pipe(
      // Use == here to not trigger on undefined -> null transition
      distinctUntilChanged((oldUserId: UserId, newUserId: UserId) => oldUserId == newUserId),
    );

    this.environment$ = account$.pipe(
      switchMap((userId) => {
        const t = userId
          ? this.stateProvider.getUser(userId, USER_ENVIRONMENT_KEY).state$
          : this.stateProvider.getGlobal(GLOBAL_ENVIRONMENT_KEY).state$;
        return t;
      }),
      map((state) => {
        return this.buildEnvironment(state?.region, state?.urls);
      }),
    );
    this.cloudWebVaultUrl$ = account$.pipe(
      switchMap((userId) => {
        const t = userId
          ? this.stateProvider.getUser(userId, USER_CLOUD_REGION_KEY).state$
          : this.stateProvider.getGlobal(GLOBAL_CLOUD_REGION_KEY).state$;
        return t;
      }),
      map((region) => {
        if (region != null) {
          const config = this.getRegionConfig(region);

          if (config != null) {
            return config.urls.webVault;
          }
        }
        return DEFAULT_REGION_CONFIG.urls.webVault;
      }),
    );
  }

  availableRegions(): RegionConfig[] {
    return PRODUCTION_REGIONS.concat(this.additionalRegionConfigs);
  }

  /**
   * Get the region configuration for the given region.
   */
  private getRegionConfig(region: Region): RegionConfig | undefined {
    return this.availableRegions().find((r) => r.key === region);
  }

  async setEnvironment(region: Region, urls?: Urls): Promise<Urls> {
    // Unknown regions are treated as self-hosted
    if (this.getRegionConfig(region) == null) {
      region = Region.SelfHosted;
    }

    // If self-hosted ensure urls are valid else fallback to default region
    if (region == Region.SelfHosted && isEmpty(urls)) {
      region = DEFAULT_REGION;
    }

    if (region != Region.SelfHosted) {
      await this.globalState.update(() => ({
        region: region,
        urls: null,
      }));

      return null;
    } else {
      // Clean the urls
      urls.base = formatUrl(urls.base);
      urls.webVault = formatUrl(urls.webVault);
      urls.api = formatUrl(urls.api);
      urls.identity = formatUrl(urls.identity);
      urls.icons = formatUrl(urls.icons);
      urls.notifications = formatUrl(urls.notifications);
      urls.events = formatUrl(urls.events);
      urls.keyConnector = formatUrl(urls.keyConnector);
      urls.scim = null;

      await this.globalState.update(() => ({
        region: region,
        urls: {
          base: urls.base,
          api: urls.api,
          identity: urls.identity,
          webVault: urls.webVault,
          icons: urls.icons,
          notifications: urls.notifications,
          events: urls.events,
          keyConnector: urls.keyConnector,
        },
      }));

      return urls;
    }
  }

  /**
   * Helper for building the environment from state. Performs some general sanitization to avoid invalid regions and urls.
   */
  protected buildEnvironment(region: Region, urls: Urls) {
    // Unknown regions are treated as self-hosted
    if (this.getRegionConfig(region) == null) {
      region = Region.SelfHosted;
    }

    // If self-hosted ensure urls are valid else fallback to default region
    if (region == Region.SelfHosted && isEmpty(urls)) {
      region = DEFAULT_REGION;
    }

    // Load urls from region config
    if (region != Region.SelfHosted) {
      const regionConfig = this.getRegionConfig(region);
      if (regionConfig != null) {
        return new CloudEnvironment(regionConfig);
      }
    }

    return new SelfHostedEnvironment(urls);
  }

  async setCloudRegion(userId: UserId, region: CloudRegion) {
    if (userId == null) {
      await this.globalCloudRegionState.update(() => region);
    } else {
      await this.stateProvider.getUser(userId, USER_CLOUD_REGION_KEY).update(() => region);
    }
  }

  getEnvironment$(userId: UserId): Observable<Environment | undefined> {
    return this.stateProvider.getUser(userId, USER_ENVIRONMENT_KEY).state$.pipe(
      map((state) => {
        return this.buildEnvironment(state?.region, state?.urls);
      }),
    );
  }

  /**
   * @deprecated Use getEnvironment$ instead.
   */
  async getEnvironment(userId?: UserId): Promise<Environment | undefined> {
    // Add backwards compatibility support for null userId
    const definedUserId = userId ?? (await firstValueFrom(this.activeAccountId$));

    return firstValueFrom(this.getEnvironment$(definedUserId));
  }

  async seedUserEnvironment(userId: UserId) {
    const global = await firstValueFrom(this.globalState.state$);
    await this.stateProvider.getUser(userId, USER_ENVIRONMENT_KEY).update(() => global);
  }
}

function formatUrl(url: string): string {
  if (url == null || url === "") {
    return null;
  }

  url = url.replace(/\/+$/g, "");
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url;
  }

  return url.trim();
}

function isEmpty(u?: Urls): boolean {
  if (u == null) {
    return true;
  }

  return (
    u.base == null &&
    u.webVault == null &&
    u.api == null &&
    u.identity == null &&
    u.icons == null &&
    u.notifications == null &&
    u.events == null
  );
}

abstract class UrlEnvironment implements Environment {
  constructor(
    protected region: Region,
    protected urls: Urls,
  ) {
    // Scim is always null for self-hosted
    if (region == Region.SelfHosted) {
      this.urls.scim = null;
    }
  }

  abstract getHostname(): string;

  getRegion() {
    return this.region;
  }

  getUrls() {
    return {
      base: this.urls.base,
      webVault: this.urls.webVault,
      api: this.urls.api,
      identity: this.urls.identity,
      icons: this.urls.icons,
      notifications: this.urls.notifications,
      events: this.urls.events,
      keyConnector: this.urls.keyConnector,
      scim: this.urls.scim,
    };
  }

  hasBaseUrl() {
    return this.urls.base != null;
  }

  getWebVaultUrl() {
    return this.getUrl("webVault", "");
  }

  getApiUrl() {
    return this.getUrl("api", "/api");
  }

  getEventsUrl() {
    return this.getUrl("events", "/events");
  }

  getIconsUrl() {
    return this.getUrl("icons", "/icons");
  }

  getIdentityUrl() {
    return this.getUrl("identity", "/identity");
  }

  getKeyConnectorUrl() {
    return this.urls.keyConnector;
  }

  getNotificationsUrl() {
    return this.getUrl("notifications", "/notifications");
  }

  getScimUrl() {
    if (this.urls.scim != null) {
      return this.urls.scim + "/v2";
    }

    return this.getWebVaultUrl() === "https://vault.bitwarden.com"
      ? "https://scim.bitwarden.com/v2"
      : this.getWebVaultUrl() + "/scim/v2";
  }

  getSendUrl() {
    return this.getWebVaultUrl() === "https://vault.bitwarden.com"
      ? "https://send.bitwarden.com/#"
      : this.getWebVaultUrl() + "/#/send/";
  }

  /**
   * Presume that if the region is not self-hosted, it is cloud.
   */
  isCloud(): boolean {
    return this.region !== Region.SelfHosted;
  }

  /**
   * Helper for getting an URL.
   *
   * @param key Key of the URL to get from URLs
   * @param baseSuffix Suffix to append to the base URL if the url is not set
   * @returns
   */
  private getUrl(key: keyof Urls, baseSuffix: string) {
    if (this.urls[key] != null) {
      return this.urls[key];
    }

    if (this.urls.base) {
      return this.urls.base + baseSuffix;
    }

    return DEFAULT_REGION_CONFIG.urls[key];
  }
}

/**
 * Denote a cloud environment.
 */
export class CloudEnvironment extends UrlEnvironment {
  constructor(private config: RegionConfig) {
    super(config.key, config.urls);
  }

  /**
   * Cloud always returns nice urls, i.e. bitwarden.com instead of vault.bitwarden.com.
   */
  getHostname() {
    return this.config.domain;
  }
}

export class SelfHostedEnvironment extends UrlEnvironment {
  constructor(urls: Urls) {
    super(Region.SelfHosted, urls);
  }

  getHostname() {
    return Utils.getHost(this.getWebVaultUrl());
  }
}
