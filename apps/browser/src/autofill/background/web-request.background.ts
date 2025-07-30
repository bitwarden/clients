// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { getOptionalUserId } from "@bitwarden/common/auth/services/account.service";
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
    private accountService: AccountService,
    private readonly webRequest: typeof chrome.webRequest,
  ) {
    this.isFirefox = platformUtilsService.isFirefox();
  }

  startListening() {
    this.webRequest.onAuthRequired.addListener(
      (async (
        details: chrome.webRequest.OnAuthRequiredDetails,
        callback: (response: chrome.webRequest.BlockingResponse) => void,
      ) => {
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
      }) as any,
      { urls: ["http://*/*", "https://*/*"] },
      [this.isFirefox ? "blocking" : "asyncBlocking"],
    );

    this.webRequest.onCompleted.addListener((details) => this.completeAuthRequest(details), {
      urls: ["http://*/*"],
    });
    this.webRequest.onErrorOccurred.addListener((details) => this.completeAuthRequest(details), {
      urls: ["http://*/*"],
    });
  }

  private async resolveAuthCredentials(
    domain: string,
    success: (response: chrome.webRequest.BlockingResponse) => void,
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

  private completeAuthRequest(details: chrome.webRequest.WebRequestDetails) {
    this.pendingAuthRequests.delete(details.requestId);
  }
}
