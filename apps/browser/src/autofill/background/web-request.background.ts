// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { UriMatchStrategy } from "@bitwarden/common/models/domain/domain-service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";

export default class WebRequestBackground {
  private pendingAuthRequests: Set<string> = new Set<string>([]);
  private isFirefox: boolean;

  constructor(
    platformUtilsService: PlatformUtilsService,
    private cipherService: CipherService,
    private authService: AuthService,
    private readonly webRequest: typeof chrome.webRequest,
  ) {
    this.isFirefox = platformUtilsService.isFirefox();
  }

  startListening() {
    this.webRequest.onAuthRequired.addListener(
      async (details, callback) => {
        if (!details.url || this.pendingAuthRequests.has(details.requestId)) {
          if (callback) {
            callback(null);
          }
          return;
        }
        this.pendingAuthRequests.add(details.requestId);
        if (this.isFirefox) {
          // eslint-disable-next-line
          return new Promise(async (resolve, reject) => {
            await this.resolveAuthCredentials(details.url, resolve, reject);
          });
        } else {
          await this.resolveAuthCredentials(details.url, callback, callback);
        }
      },
      { urls: ["http://*/*", "https://*/*"] },
      [this.isFirefox ? "blocking" : "asyncBlocking"],
    );

    this.webRequest.onCompleted.addListener((details) => this.completeAuthRequest(details), {
      urls: ["http://*/*"],
    });
    this.webRequest.onErrorOccurred.addListener(
      (details: any) => this.completeAuthRequest(details),
      {
        urls: ["http://*/*"],
      },
    );
  }

  // eslint-disable-next-line
  private async resolveAuthCredentials(domain: string, success: Function, error: Function) {
    if ((await this.authService.getAuthStatus()) < AuthenticationStatus.Unlocked) {
      error();
      return;
    }

    try {
      const ciphers = await this.cipherService.getAllDecryptedForUrl(
        domain,
        null,
        UriMatchStrategy.Host,
      );
      if (ciphers == null || ciphers.length !== 1) {
        error();
        return;
      }

      success({
        authCredentials: {
          username: ciphers[0].login.username,
          password: ciphers[0].login.password,
        },
      });
    } catch {
      error();
    }
  }

  private completeAuthRequest(details: chrome.webRequest.WebResponseCacheDetails) {
    this.pendingAuthRequests.delete(details.requestId);
  }
}
