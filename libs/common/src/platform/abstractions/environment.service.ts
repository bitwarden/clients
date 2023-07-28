import { Observable } from "rxjs";

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

export type PayPalConfig = {
  businessId?: string;
  buttonAction?: string;
};

export enum Region {
  US = "US",
  EU = "EU",
  SelfHosted = "Self-hosted",
}

export enum RegionDomain {
  US = "bitwarden.com",
  EU = "bitwarden.eu",
  USQA = "bitwarden.pw",
}

export abstract class EnvironmentService {
  urls: Observable<void>;
  usUrls: Urls;
  euUrls: Urls;
  selectedRegion?: Region;
  initialized = true;

  hasBaseUrl: () => boolean;
  getNotificationsUrl: () => string;
  getWebVaultUrl: () => string;
  /**
   * Retrieves the URL of the cloud web vault app.
   *
   * @returns {string} The URL of the cloud web vault app.
   * @remarks Use this method only in views exclusive to self-host instances.
   */
  getCloudWebVaultUrl: () => string;
  /**
   * Sets the URL of the cloud web vault app based on the region parameter.
   *
   * @param {Region} region - The region of the cloud web vault app.
   */
  setCloudWebVaultUrl: (region: Region) => void;
  getSendUrl: () => string;
  getIconsUrl: () => string;
  getApiUrl: () => string;
  getIdentityUrl: () => string;
  getEventsUrl: () => string;
  getKeyConnectorUrl: () => string;
  getScimUrl: () => string;
  setUrlsFromStorage: () => Promise<void>;
  setUrls: (urls: Urls) => Promise<Urls>;
  setRegion: (region: Region) => Promise<void>;
  getUrls: () => Urls;
  isCloud: () => boolean;
  isEmpty: () => boolean;
}
