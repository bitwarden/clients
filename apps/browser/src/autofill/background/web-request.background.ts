import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { getOptionalUserId } from "@bitwarden/common/auth/services/account.service";
import { UriMatchStrategy } from "@bitwarden/common/models/domain/domain-service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";

type FirefoxProxyInfo = {
  host?: string;
  port?: number;
  type?: string;
};

// see https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/webRequest/onAuthRequired#additional_objects
type AuthRequiredDetailsWithProxyInfo = chrome.webRequest.OnAuthRequiredDetails & {
  isProxy?: boolean;
  scheme?: string;
  challenger?: {
    host?: string;
    port?: number;
  };
  proxyInfo?: FirefoxProxyInfo;
};

export default class WebRequestBackground {
  private pendingAuthRequests: Set<string> = new Set<string>([]);
  private isFirefox: boolean;

  constructor(
    platformUtilsService: PlatformUtilsService,
    private cipherService: CipherService,
    private authService: AuthService,
    private accountService: AccountService,
    private readonly webRequest: typeof chrome.webRequest,
  ) {
    this.isFirefox = platformUtilsService.isFirefox();
  }

  startListening() {
    this.webRequest.onAuthRequired.addListener(
      (async (
        details: chrome.webRequest.OnAuthRequiredDetails,
        callback: (response: chrome.webRequest.BlockingResponse | null) => void,
      ) => {
        if (this.pendingAuthRequests.has(details.requestId)) {
          if (callback) {
            callback(null);
          }
          return;
        }

        const authUrl = this.getAuthUrl(details);
        if (authUrl == null) {
          if (callback) {
            callback(null);
          }
          return;
        }

        this.pendingAuthRequests.add(details.requestId);
        if (this.isFirefox) {
          // eslint-disable-next-line
          return new Promise(async (resolve, reject) => {
            await this.resolveAuthCredentials(authUrl, resolve, reject);
          });
        } else {
          await this.resolveAuthCredentials(authUrl, callback, callback);
        }
      }) as any,
      { urls: ["http://*/*", "https://*/*"] },
      [this.isFirefox ? "blocking" : "asyncBlocking"],
    );

    this.webRequest.onCompleted.addListener((details) => this.completeAuthRequest(details), {
      urls: ["http://*/*", "https://*/*"],
    });
    this.webRequest.onErrorOccurred.addListener((details) => this.completeAuthRequest(details), {
      urls: ["http://*/*", "https://*/*"],
    });
  }

  private getAuthUrl(details: chrome.webRequest.OnAuthRequiredDetails): string | null {
    const authDetails = details as AuthRequiredDetailsWithProxyInfo;

    if (authDetails.isProxy !== true) {
      return details.url ?? null;
    }

    if (authDetails.scheme !== "basic") {
      return null;
    }

    const host = authDetails.proxyInfo?.host ?? authDetails.challenger?.host;
    const port = authDetails.proxyInfo?.port ?? authDetails.challenger?.port;

    if (host == null || host === "") {
      return null;
    }

    const protocol = authDetails.proxyInfo?.type === "https" ? "https" : "http";
    const portPart = port == null ? "" : `:${port}`;

    return `${protocol}://${host}${portPart}`;
  }

  private async resolveAuthCredentials(
    domain: string,
    success: (response: chrome.webRequest.BlockingResponse | null) => void,
    // eslint-disable-next-line
    error: Function,
  ) {
    const activeUserId = await firstValueFrom(
      this.accountService.activeAccount$.pipe(getOptionalUserId),
    );
    if (activeUserId == null) {
      error();
      return;
    }

    const authStatus = await firstValueFrom(this.authService.authStatusFor$(activeUserId));
    if (authStatus < AuthenticationStatus.Unlocked) {
      error();
      return;
    }

    try {
      const ciphers = await this.cipherService.getAllDecryptedForUrl(
        domain,
        activeUserId,
        undefined,
        UriMatchStrategy.Host,
      );
      if (ciphers == null || ciphers.length !== 1) {
        error();
        return;
      }

      const username = ciphers[0].login?.username;
      const password = ciphers[0].login?.password;
      if (username == null || password == null) {
        error();
        return;
      }

      success({
        authCredentials: {
          username,
          password,
        },
      });
    } catch {
      error();
    }
  }

  private completeAuthRequest(details: chrome.webRequest.WebRequestDetails) {
    this.pendingAuthRequests.delete(details.requestId);
  }
}
