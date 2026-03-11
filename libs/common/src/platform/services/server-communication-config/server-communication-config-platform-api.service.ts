import { Subscription } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CommandDefinition, MessageListener } from "@bitwarden/common/platform/messaging";
import { AcquiredCookie, ServerCommunicationConfigPlatformApi } from "@bitwarden/sdk-internal";

export const SSO_COOKIE_VENDOR_CALLBACK_COMMAND = new CommandDefinition<{ urlString: string }>(
  "ssoCookieVendorCallback",
);

/**
 * API implementation for SSO cookie acquisition.
 *
 * Handles browser launch and deep link callback processing for SSO cookie vendor flows.
 * Uses the MessageListener to listen for deep link callbacks from app.component.ts.
 *
 * @remarks
 * - Opens browser via platformUtilsService.launchUri()
 * - Listens for callbacks via MessageListener subscribing to SSO_COOKIE_VENDOR_CALLBACK_COMMAND
 * - Deduplicates concurrent calls (single in-flight promise)
 * - 5-minute timeout for safety
 * - Returns undefined on timeout/cancellation (not error)
 *
 */
export class ServerCommunicationConfigPlatformApiService implements ServerCommunicationConfigPlatformApi {
  private pendingAcquisition: {
    hostname: string;
    resolve: (cookies: AcquiredCookie[] | undefined) => void;
    timeoutId: NodeJS.Timeout;
  } | null = null;

  // Listen for callback messages from app.component.ts
  private callbackSubscription: Subscription | null = this.messageListener
    .messages$(SSO_COOKIE_VENDOR_CALLBACK_COMMAND)
    .subscribe((msg) => {
      this.handleCallback(msg.urlString);
    });

  private static readonly TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

  constructor(
    private platformUtilsService: PlatformUtilsService,
    private messageListener: MessageListener,
    private logService: LogService,
  ) {}

  async acquireCookies(hostname: string): Promise<AcquiredCookie[] | undefined> {
    // Deduplicate concurrent calls - return existing promise
    if (this.pendingAcquisition) {
      if (this.pendingAcquisition.hostname === hostname) {
        this.logService.info(
          "Cookie acquisition already in progress for hostname, returning existing promise",
        );
        return new Promise((resolve) => {
          const existing = this.pendingAcquisition!.resolve;
          this.pendingAcquisition!.resolve = (cookies) => {
            existing(cookies);
            resolve(cookies);
          };
        });
      } else {
        // Different hostname - cancel previous and start new
        this.logService.warning("Cancelling previous cookie acquisition for different hostname");
        this.cleanup();
      }
    }

    return new Promise((resolve) => {
      // Set 5-minute timeout
      const timeoutId = setTimeout(() => {
        this.logService.warning(`Cookie acquisition timeout for ${hostname}`);
        this.cleanup();
        resolve(undefined);
      }, ServerCommunicationConfigPlatformApiService.TIMEOUT_MS);

      this.pendingAcquisition = { hostname, resolve, timeoutId };

      // Open browser to cookie redirect page
      // FIXME: Ensure that hostname either includes the schema and remove the httpsL//-prefiox or strip it beforehand
      const url = `https://${hostname}/proxy-cookie-redirect-connector.html`;
      this.logService.info(`Opening browser for cookie acquisition: ${url}`);
      this.platformUtilsService.launchUri(url);
    });
  }

  /**
   * Handles deep link callback from browser.
   * Called via MessageListener subscription when app.component.ts sends callback message.
   *
   * @param urlString - Full callback URL with query parameters
   */
  private handleCallback(urlString: string): void {
    if (!this.pendingAcquisition) {
      this.logService.warning("Received cookie callback but no acquisition pending");
      return;
    }

    try {
      const url = new URL(urlString);
      const cookies: AcquiredCookie[] = [];

      // Parse all query params except 'd' (integrity marker)
      for (const [name, value] of url.searchParams.entries()) {
        if (name !== "d") {
          cookies.push({ name, value });
        }
      }

      this.logService.info(`Acquired ${cookies.length} cookie(s)`);
      clearTimeout(this.pendingAcquisition.timeoutId);
      this.pendingAcquisition.resolve(cookies.length > 0 ? cookies : undefined);
      this.cleanup();
    } catch (error) {
      this.logService.error("Failed to parse cookie callback URL", error);
      clearTimeout(this.pendingAcquisition.timeoutId);
      this.pendingAcquisition.resolve(undefined);
      this.cleanup();
    }
  }

  /**
   * Cleans up pending acquisition state.
   */
  private cleanup(): void {
    this.pendingAcquisition = null;
  }
}
