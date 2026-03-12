import { Observable } from "rxjs";

/**
 * Service for managing server communication configuration,
 * including bootstrap detection and cookie management.
 */
export abstract class ServerCommunicationConfigService {
  /**
   * Initializes the service and creates the SDK-based ServerCommunicationConfigClient
   */
  abstract init(): Promise<void>;

  /**
   * Observable that emits true when the specified hostname
   * requires bootstrap (cookie acquisition) before API calls can succeed.
   *
   * Automatically updates when server communication config state changes.
   *
   * @param hostname - The server hostname (e.g., "vault.acme.com")
   * @returns Observable that emits bootstrap status for the hostname
   */
  abstract needsBootstrap$(hostname: string): Observable<boolean>;

  /**
   * Retrieves cookies that should be included in HTTP requests
   * to the specified hostname.
   *
   * @param hostname - The server hostname
   * @returns Promise resolving to array of [cookie_name, cookie_value] tuples
   */
  abstract getCookies(hostname: string): Promise<Array<[string, string]>>;

  /**
   * Initiates cookie acquisition flow for the specified hostname.
   * Opens browser for user authentication, then captures and validates cookies.
   *
   * @param url - The server url requiring cookies
   * @returns Promise that resolves when cookies acquired and saved, or rejects on error/cancellation
   * @throws AcquireCookieError on validation failure or cancellation
   */
  abstract acquireCookie(url: string): Promise<void>;
}
