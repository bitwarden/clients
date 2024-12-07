import { SsoComponentService, SsoClientType } from "./sso-component.service";

export class DefaultSsoComponentService implements SsoComponentService {
  /**
   * The client ID for the SSO component service. Either "browser", "extension", or "desktop".
   */
  clientId: SsoClientType;

  /**
   * Default no-op implementation as extension and desktop don't need to set cookies.
   */
  setDocumentCookies(): void {}

  /**
   * Default undefined implementation as extension and desktop don't need to close windows.
   */
  closeWindow: () => undefined | Promise<void>;

  /**
   * Default undefined implementation as extension and desktop don't need to prevent clearing keys.
   */
  preventClearingKeys?: () => undefined | Promise<void>;
}
