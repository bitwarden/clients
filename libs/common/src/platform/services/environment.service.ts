import {
  concatMap,
  distinctUntilChanged,
  firstValueFrom,
  map,
  Observable,
  ReplaySubject,
} from "rxjs";

import { AccountService } from "../../auth/abstractions/account.service";
import { EnvironmentUrls } from "../../auth/models/domain/environment-urls";
import { UserId } from "../../types/guid";
import {
  EnvironmentService as EnvironmentServiceAbstraction,
  Region,
  RegionConfig,
  Urls,
} from "../abstractions/environment.service";
import { Utils } from "../misc/utils";
import { ENVIRONMENT_DISK, GlobalState, KeyDefinition, StateProvider } from "../state";

const REGION_KEY = new KeyDefinition<Region>(ENVIRONMENT_DISK, "region", {
  deserializer: (s) => s,
});

const URLS_KEY = new KeyDefinition<EnvironmentUrls>(ENVIRONMENT_DISK, "urls", {
  deserializer: EnvironmentUrls.fromJSON,
});

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

export class EnvironmentService implements EnvironmentServiceAbstraction {
  private readonly urlsSubject = new ReplaySubject<void>(1);
  urls: Observable<void> = this.urlsSubject.asObservable();
  selectedRegion?: Region;
  initialized = false;

  protected baseUrl: string;
  protected webVaultUrl: string;
  protected apiUrl: string;
  protected identityUrl: string;
  protected iconsUrl: string;
  protected notificationsUrl: string;
  protected eventsUrl: string;
  private keyConnectorUrl: string;
  private scimUrl: string = null;
  private cloudWebVaultUrl: string;

  private regionGlobalState: GlobalState<Region | null>;
  private urlsGlobalState: GlobalState<EnvironmentUrls | null>;

  private activeAccountId$: Observable<UserId | null>;

  constructor(
    private stateProvider: StateProvider,
    private accountService: AccountService,
  ) {
    // We intentionally don't want the helper on account service, we want the null back if there is no active user
    this.activeAccountId$ = this.accountService.activeAccount$.pipe(map((a) => a?.id));

    // TODO: Get rid of early subscription during EnvironmentService refactor
    this.activeAccountId$
      .pipe(
        // Use == here to not trigger on undefined -> null transition
        distinctUntilChanged((oldUserId: string, newUserId: string) => oldUserId == newUserId),
        concatMap(async () => {
          if (!this.initialized) {
            return;
          }
          await this.setUrlsFromStorage();
        }),
      )
      .subscribe();

    this.regionGlobalState = this.stateProvider.getGlobal(REGION_KEY);
    this.urlsGlobalState = this.stateProvider.getGlobal(URLS_KEY);
  }

  availableRegions(): RegionConfig[] {
    const additionalRegions = (process.env.ADDITIONAL_REGIONS as unknown as RegionConfig[]) ?? [];
    return PRODUCTION_REGIONS.concat(additionalRegions);
  }

  /**
   * Get the region configuration for the given region.
   */
  private getRegionConfig(region: Region): RegionConfig | undefined {
    return this.availableRegions().find((r) => r.key === region);
  }

  hasBaseUrl() {
    return this.baseUrl != null;
  }

  getNotificationsUrl() {
    if (this.notificationsUrl != null) {
      return this.notificationsUrl;
    }

    if (this.baseUrl != null) {
      return this.baseUrl + "/notifications";
    }

    return "https://notifications.bitwarden.com";
  }

  getWebVaultUrl() {
    if (this.webVaultUrl != null) {
      return this.webVaultUrl;
    }

    if (this.baseUrl) {
      return this.baseUrl;
    }
    return "https://vault.bitwarden.com";
  }

  getCloudWebVaultUrl() {
    if (this.cloudWebVaultUrl != null) {
      return this.cloudWebVaultUrl;
    }

    return DEFAULT_REGION_CONFIG.urls.webVault;
  }

  setCloudWebVaultUrl(region: Region) {
    const r = this.getRegionConfig(region);

    if (r != null) {
      this.cloudWebVaultUrl = r.urls.webVault;
    }
  }

  getSendUrl() {
    return this.getWebVaultUrl() === "https://vault.bitwarden.com"
      ? "https://send.bitwarden.com/#"
      : this.getWebVaultUrl() + "/#/send/";
  }

  getIconsUrl() {
    if (this.iconsUrl != null) {
      return this.iconsUrl;
    }

    if (this.baseUrl) {
      return this.baseUrl + "/icons";
    }

    return "https://icons.bitwarden.net";
  }

  getApiUrl() {
    if (this.apiUrl != null) {
      return this.apiUrl;
    }

    if (this.baseUrl) {
      return this.baseUrl + "/api";
    }

    return "https://api.bitwarden.com";
  }

  getIdentityUrl() {
    if (this.identityUrl != null) {
      return this.identityUrl;
    }

    if (this.baseUrl) {
      return this.baseUrl + "/identity";
    }

    return "https://identity.bitwarden.com";
  }

  getEventsUrl() {
    if (this.eventsUrl != null) {
      return this.eventsUrl;
    }

    if (this.baseUrl) {
      return this.baseUrl + "/events";
    }

    return "https://events.bitwarden.com";
  }

  getKeyConnectorUrl() {
    return this.keyConnectorUrl;
  }

  getScimUrl() {
    if (this.scimUrl != null) {
      return this.scimUrl + "/v2";
    }

    return this.getWebVaultUrl() === "https://vault.bitwarden.com"
      ? "https://scim.bitwarden.com/v2"
      : this.getWebVaultUrl() + "/scim/v2";
  }

  async setUrlsFromStorage(): Promise<void> {
    const activeUserId = await firstValueFrom(this.activeAccountId$);

    const region = await this.getRegion(activeUserId);
    const savedUrls = await this.getEnvironmentUrls(activeUserId);

    switch (region) {
      case Region.EU:
        await this.setRegion(Region.EU);
        return;
      case Region.US:
        await this.setRegion(Region.US);
        return;
      case Region.SelfHosted:
      case null:
      default:
        this.baseUrl = savedUrls.base;
        this.webVaultUrl = savedUrls.webVault;
        this.apiUrl = savedUrls.api;
        this.identityUrl = savedUrls.identity;
        this.iconsUrl = savedUrls.icons;
        this.notificationsUrl = savedUrls.notifications;
        this.eventsUrl = savedUrls.events;
        this.keyConnectorUrl = savedUrls.keyConnector;
        await this.setRegion(Region.SelfHosted);
        // scimUrl is not saved to storage
        this.urlsSubject.next();
        break;
    }
  }

  async setUrls(urls: Urls): Promise<Urls> {
    urls.base = this.formatUrl(urls.base);
    urls.webVault = this.formatUrl(urls.webVault);
    urls.api = this.formatUrl(urls.api);
    urls.identity = this.formatUrl(urls.identity);
    urls.icons = this.formatUrl(urls.icons);
    urls.notifications = this.formatUrl(urls.notifications);
    urls.events = this.formatUrl(urls.events);
    urls.keyConnector = this.formatUrl(urls.keyConnector);

    // Don't save scim url
    await this.urlsGlobalState.update(() => ({
      base: urls.base,
      api: urls.api,
      identity: urls.identity,
      webVault: urls.webVault,
      icons: urls.icons,
      notifications: urls.notifications,
      events: urls.events,
      keyConnector: urls.keyConnector,
    }));

    this.baseUrl = urls.base;
    this.webVaultUrl = urls.webVault;
    this.apiUrl = urls.api;
    this.identityUrl = urls.identity;
    this.iconsUrl = urls.icons;
    this.notificationsUrl = urls.notifications;
    this.eventsUrl = urls.events;
    this.keyConnectorUrl = urls.keyConnector;
    this.scimUrl = null; // Scrim is only set from the region

    await this.setRegion(Region.SelfHosted);

    this.urlsSubject.next();

    return urls;
  }

  getUrls() {
    return {
      base: this.baseUrl,
      webVault: this.webVaultUrl,
      cloudWebVault: this.cloudWebVaultUrl,
      api: this.apiUrl,
      identity: this.identityUrl,
      icons: this.iconsUrl,
      notifications: this.notificationsUrl,
      events: this.eventsUrl,
      keyConnector: this.keyConnectorUrl,
      scim: this.scimUrl,
    };
  }

  isEmpty(): boolean {
    return (
      this.baseUrl == null &&
      this.webVaultUrl == null &&
      this.apiUrl == null &&
      this.identityUrl == null &&
      this.iconsUrl == null &&
      this.notificationsUrl == null &&
      this.eventsUrl == null
    );
  }

  async getHost(userId?: UserId) {
    const region = await this.getRegion(userId);
    const regionConfig = this.getRegionConfig(region);

    if (regionConfig != null) {
      return regionConfig.domain;
    }

    // No environment found, assume self-hosted
    const envUrls = await this.getEnvironmentUrls(userId);
    return Utils.getHost(envUrls.webVault || envUrls.base);
  }

  private async getRegion(userId: UserId | null) {
    // Previous rules dictated that we only get from user scoped state if there is an active user.
    const activeUserId = await firstValueFrom(this.activeAccountId$);
    return activeUserId == null
      ? await firstValueFrom(this.regionGlobalState.state$)
      : await firstValueFrom(this.stateProvider.getUser(userId ?? activeUserId, REGION_KEY).state$);
  }

  private async getEnvironmentUrls(userId: UserId | null) {
    return userId == null
      ? (await firstValueFrom(this.urlsGlobalState.state$)) ?? new EnvironmentUrls()
      : (await firstValueFrom(this.stateProvider.getUser(userId, URLS_KEY).state$)) ??
          new EnvironmentUrls();
  }

  async setRegion(region: Region) {
    this.selectedRegion = region;
    await this.regionGlobalState.update(() => region);

    if (region === Region.SelfHosted) {
      // If user saves a self-hosted region with empty fields, default to US
      if (this.isEmpty()) {
        await this.setRegion(DEFAULT_REGION);
      }
    } else {
      // If we are setting the region to EU or US, clear the self-hosted URLs
      await this.urlsGlobalState.update(() => new EnvironmentUrls());

      this.setUrlsInternal(this.getRegionConfig(region).urls);
    }
  }

  async seedUserEnvironment(userId: UserId) {
    const globalRegion = await firstValueFrom(this.regionGlobalState.state$);
    const globalUrls = await firstValueFrom(this.urlsGlobalState.state$);
    await this.stateProvider.getUser(userId, REGION_KEY).update(() => globalRegion);
    await this.stateProvider.getUser(userId, URLS_KEY).update(() => globalUrls);
  }

  protected setUrlsInternal(urls: Urls) {
    this.baseUrl = this.formatUrl(urls.base);
    this.webVaultUrl = this.formatUrl(urls.webVault);
    this.apiUrl = this.formatUrl(urls.api);
    this.identityUrl = this.formatUrl(urls.identity);
    this.iconsUrl = this.formatUrl(urls.icons);
    this.notificationsUrl = this.formatUrl(urls.notifications);
    this.eventsUrl = this.formatUrl(urls.events);
    this.keyConnectorUrl = this.formatUrl(urls.keyConnector);
    this.scimUrl = this.formatUrl(urls.scim);

    this.urlsSubject.next();
  }

  private formatUrl(url: string): string {
    if (url == null || url === "") {
      return null;
    }

    url = url.replace(/\/+$/g, "");
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }

    return url.trim();
  }

  isCloud(): boolean {
    return [
      "https://api.bitwarden.com",
      "https://vault.bitwarden.com/api",
      "https://api.bitwarden.eu",
      "https://vault.bitwarden.eu/api",
    ].includes(this.getApiUrl());
  }
}
