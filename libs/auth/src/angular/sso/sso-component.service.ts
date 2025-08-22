import { ClientType } from "@bitwarden/common/enums";

export type SsoClientType =
  | ClientType.Web
  | ClientType.Browser
  | ClientType.Desktop
  | ClientType.Cli;

/**
 * Abstract class for SSO component services.
 */
export abstract class SsoComponentService {
  /**
   * Sets the cookies for the SSO component service.
   * Used to pass translation messages to the SSO connector page (apps/web/src/connectors/sso.ts) during the SSO handoff process.
   * See implementation in WebSsoComponentService for example usage.
   */
  setDocumentCookies?(): void;

  /**
   * Closes the window.
   */
  closeWindow?(): Promise<void>;
}
