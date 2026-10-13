import { Subscription } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CommandDefinition, MessageListener } from "@bitwarden/common/platform/messaging";
import { DialogService } from "@bitwarden/components";
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
 * - Prompts user to open browser to a specific URL for cookie acquisition
 * - Listens for callbacks via MessageListener subscribing to SSO_COOKIE_VENDOR_CALLBACK_COMMAND
 * - Deduplicates concurrent calls across both the dialog phase and callback-waiting phase
 * - 5-minute timeout for safety
 * - Returns undefined on timeout/cancellation (not error)
 *
 */
export class ServerCommunicationConfigPlatformApiService implements ServerCommunicationConfigPlatformApi {
  // Tracks the hostname and shared promise for the full flow (dialog + callback).
  // Used for deduplication: a second call for the same hostname returns this promise directly.
  private pendingHostname: string | null = null;
  private pendingPromise: Promise<AcquiredCookie[] | undefined> | null = null;

  // Tracks only the callback-waiting phase (set after the user approves the dialog).
  // Used by handleCallback and cancelPendingAcquisition to resolve/cancel the callback wait.
  private pendingAcquisition: {
    resolve: (cookies: AcquiredCookie[] | undefined) => void;
    timeoutId: NodeJS.Timeout;
  } | null = null;

  private callbackSubscription: Subscription | null = null;

  private static readonly TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

  constructor(
    private platformUtilsService: PlatformUtilsService,
    private messageListener: MessageListener,
    private logService: LogService,
    private dialogService: DialogService,
  ) {}

  // Listen for callback messages from app.component.ts
  init() {
    this.callbackSubscription = this.messageListener
      .messages$(SSO_COOKIE_VENDOR_CALLBACK_COMMAND)
      .subscribe((msg) => {
        this.handleCallback(msg.urlString);
      });
  }

  async acquireCookies(vaultUrl: string): Promise<AcquiredCookie[] | undefined> {
    if (this.pendingHostname !== null) {
      if (this.pendingHostname === vaultUrl && this.pendingPromise !== null) {
        // Same hostname - return the shared in-flight promise (covers both dialog and callback phases)
        this.logService.info(
          "Cookie acquisition already in progress for hostname, returning existing promise",
        );
        return this.pendingPromise;
      }
      // Different hostname - cancel previous and start new
      this.logService.warning("Cancelling previous cookie acquisition for different hostname");
      this.cancelPendingAcquisition();
    }

    const normalizedVaultUrl = vaultUrl.startsWith("https://") ? vaultUrl : `https://${vaultUrl}`;
    const url = `${normalizedVaultUrl}/proxy-cookie-redirect-connector.html`;
    this.logService.info(`Opening browser for cookie acquisition: ${url}`);

    this.pendingHostname = vaultUrl;
    this.pendingPromise = this.runAcquisitionFlow(vaultUrl, url, normalizedVaultUrl);
    return this.pendingPromise;
  }

  /**
   * Runs the full acquisition flow: dialog prompt, then browser launch and callback wait.
   * Separated from acquireCookies so the promise can be shared across concurrent callers.
   */
  private async runAcquisitionFlow(
    vaultUrl: string,
    url: string,
    normalizedVaultUrl: string,
  ): Promise<AcquiredCookie[] | undefined> {
    try {
      const approved = await this.dialogService.openSimpleDialog({
        title: { key: "syncWithBrowser" },
        content: { key: "acquireCookieSpeedbumpContent", placeholders: [normalizedVaultUrl] },
        acceptButtonText: { key: "launchBrowser" },
        cancelButtonText: { key: "later" },
        type: "warning",
      });

      // Guard: a different-hostname call may have cancelled this flow while the dialog was open
      if (this.pendingHostname !== vaultUrl) {
        return undefined;
      }

      if (!approved) {
        return undefined;
      }

      return await new Promise<AcquiredCookie[] | undefined>((resolve) => {
        const timeoutId = setTimeout(() => {
          this.logService.warning(`Cookie acquisition timeout for ${vaultUrl}`);
          this.pendingAcquisition = null;
          resolve(undefined);
        }, ServerCommunicationConfigPlatformApiService.TIMEOUT_MS);

        this.pendingAcquisition = { resolve, timeoutId };
        this.platformUtilsService.launchUri(url);
      });
    } finally {
      // Only clear shared state if this flow is still the active one
      if (this.pendingHostname === vaultUrl) {
        this.pendingHostname = null;
        this.pendingPromise = null;
        this.pendingAcquisition = null;
      }
    }
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
      const { resolve } = this.pendingAcquisition;
      this.pendingAcquisition = null;
      resolve(cookies.length > 0 ? cookies : undefined);
    } catch (error) {
      this.logService.error("Failed to parse cookie callback URL", error);
      this.cancelPendingAcquisition();
    }
  }

  private cancelPendingAcquisition(): void {
    this.logService.info("Cancelling pending cookie acquisition");
    if (this.pendingAcquisition) {
      clearTimeout(this.pendingAcquisition.timeoutId);
      this.pendingAcquisition.resolve(undefined);
      this.pendingAcquisition = null;
    }
    this.pendingHostname = null;
    this.pendingPromise = null;
  }
}
