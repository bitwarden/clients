import { concatMap, Observable, Subject } from "rxjs";

import { EnvironmentUrls } from "../../auth/models/domain/environment-urls";
import {
  EnvironmentService as EnvironmentServiceAbstraction,
  Urls,
} from "../abstractions/environment.service";
import { StateService } from "../abstractions/state.service";

export class EnvironmentService implements EnvironmentServiceAbstraction {
  private readonly urlsSubject = new Subject<Urls>();
  urls: Observable<Urls> = this.urlsSubject;

  protected baseUrl: string;
  protected webVaultUrl: string;
  protected apiUrl: string;
  protected identityUrl: string;
  protected iconsUrl: string;
  protected notificationsUrl: string;
  protected eventsUrl: string;
  private keyConnectorUrl: string;
  private scimUrl: string = null;

  constructor(private stateService: StateService) {
    this.stateService.activeAccount$
      .pipe(
        concatMap(async () => {
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
    const urls: any = await this.stateService.getEnvironmentUrls();
    const envUrls = new EnvironmentUrls();

    this.baseUrl = envUrls.base = urls.base;
    this.webVaultUrl = urls.webVault;
    this.apiUrl = envUrls.api = urls.api;
    this.identityUrl = envUrls.identity = urls.identity;
    this.iconsUrl = urls.icons;
    this.notificationsUrl = urls.notifications;
    this.eventsUrl = envUrls.events = urls.events;
    this.keyConnectorUrl = urls.keyConnector;
    // scimUrl is not saved to storage

    this.urlsSubject.next(envUrls);
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

    this.urlsSubject.next(urls);

    return urls;
  }

  getUrls() {
    return {
      base: this.baseUrl,
      webVault: this.webVaultUrl,
      api: this.apiUrl,
      identity: this.identityUrl,
      icons: this.iconsUrl,
      notifications: this.notificationsUrl,
      events: this.eventsUrl,
      keyConnector: this.keyConnectorUrl,
      scim: this.scimUrl,
    };
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
    return ["https://api.bitwarden.com", "https://vault.bitwarden.com/api"].includes(
      this.getApiUrl()
    );
  }

  isSelfHosted(): boolean {
    return ![
      "http://vault.bitwarden.com",
      "https://vault.bitwarden.com",
      "http://vault.bitwarden.eu",
      "https://vault.bitwarden.eu",
      "http://vault.qa.bitwarden.pw",
      "https://vault.qa.bitwarden.pw",
    ].includes(this.getWebVaultUrl());
  }
}
