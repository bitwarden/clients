import { concatMap, Observable, ReplaySubject } from "rxjs";

import { EnvironmentUrls } from "../../auth/models/domain/environment-urls";
import {
  EnvironmentService as EnvironmentServiceAbstraction,
  Region,
  Urls,
} from "../abstractions/environment.service";
import { StateService } from "../abstractions/state.service";

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

  readonly usUrls: Urls = {
    base: null,
    api: "https://api.bitwarden.com",
    identity: "https://identity.bitwarden.com",
    icons: "https://icons.bitwarden.net",
    webVault: "https://vault.bitwarden.com",
    notifications: "https://notifications.bitwarden.com",
    events: "https://events.bitwarden.com",
    scim: "https://scim.bitwarden.com",
  };

  readonly euUrls: Urls = {
    base: null,
    api: "https://api.bitwarden.eu",
    identity: "https://identity.bitwarden.eu",
    icons: "https://icons.bitwarden.eu",
    webVault: "https://vault.bitwarden.eu",
    notifications: "https://notifications.bitwarden.eu",
    events: "https://events.bitwarden.eu",
    scim: "https://scim.bitwarden.eu",
  };

  constructor(private stateService: StateService) {
    this.stateService.activeAccount$
      .pipe(
        concatMap(async () => {
          if (!this.initialized) {
            return;
          }
          await this.setUrlsFromStorage();
        })
      )
      .subscribe();
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

    return this.usUrls.webVault;
  }

  setCloudWebVaultUrl(region: Region) {
    switch (region) {
      case Region.EU:
        this.cloudWebVaultUrl = this.euUrls.webVault;
        break;
      case Region.US:
      default:
        this.cloudWebVaultUrl = this.usUrls.webVault;
        break;
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
    const region = await this.stateService.getRegion();
    const savedUrls = await this.stateService.getEnvironmentUrls();
    const envUrls = new EnvironmentUrls();

    // In release `2023.5.0`, we set the `base` property of the environment URLs to the US web vault URL when a user clicked the "US" region.
    // This check will detect these cases and convert them to the proper region instead.
    // We are detecting this by checking for the presence of the web vault URL in the `base` and the absence of the `notifications` property.
    // This is because the `notifications` will not be `null` in the web vault, and we don't want to migrate the URLs in that case.
    if (savedUrls.base === "https://vault.bitwarden.com" && savedUrls.notifications == null) {
      await this.setRegion(Region.US);
      return;
    }

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
        this.baseUrl = envUrls.base = savedUrls.base;
        this.webVaultUrl = savedUrls.webVault;
        this.apiUrl = envUrls.api = savedUrls.api;
        this.identityUrl = envUrls.identity = savedUrls.identity;
        this.iconsUrl = savedUrls.icons;
        this.notificationsUrl = savedUrls.notifications;
        this.eventsUrl = envUrls.events = savedUrls.events;
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

    // scimUrl cannot be cleared
    urls.scim = this.formatUrl(urls.scim) ?? this.scimUrl;

    await this.stateService.setEnvironmentUrls({
      base: urls.base,
      api: urls.api,
      identity: urls.identity,
      webVault: urls.webVault,
      icons: urls.icons,
      notifications: urls.notifications,
      events: urls.events,
      keyConnector: urls.keyConnector,
      // scimUrl is not saved to storage
    });

    this.baseUrl = urls.base;
    this.webVaultUrl = urls.webVault;
    this.apiUrl = urls.api;
    this.identityUrl = urls.identity;
    this.iconsUrl = urls.icons;
    this.notificationsUrl = urls.notifications;
    this.eventsUrl = urls.events;
    this.keyConnectorUrl = urls.keyConnector;
    this.scimUrl = urls.scim;

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

  async setRegion(region: Region) {
    this.selectedRegion = region;
    await this.stateService.setRegion(region);

    if (region === Region.SelfHosted) {
      // If user saves a self-hosted region with empty fields, default to US
      if (this.isEmpty()) {
        await this.setRegion(Region.US);
      }
    } else {
      // If we are setting the region to EU or US, clear the self-hosted URLs
      await this.stateService.setEnvironmentUrls(new EnvironmentUrls());
      if (region === Region.EU) {
        this.setUrlsInternal(this.euUrls);
      } else if (region === Region.US) {
        this.setUrlsInternal(this.usUrls);
      }
    }
  }

  private setUrlsInternal(urls: Urls) {
    this.baseUrl = this.formatUrl(urls.base);
    this.webVaultUrl = this.formatUrl(urls.webVault);
    this.apiUrl = this.formatUrl(urls.api);
    this.identityUrl = this.formatUrl(urls.identity);
    this.iconsUrl = this.formatUrl(urls.icons);
    this.notificationsUrl = this.formatUrl(urls.notifications);
    this.eventsUrl = this.formatUrl(urls.events);
    this.keyConnectorUrl = this.formatUrl(urls.keyConnector);

    // scimUrl cannot be cleared
    this.scimUrl = this.formatUrl(urls.scim) ?? this.scimUrl;
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
