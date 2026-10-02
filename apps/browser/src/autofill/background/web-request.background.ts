import {
  catchError,
  combineLatest,
  distinctUntilChanged,
  firstValueFrom,
  map,
  Observable,
  of,
  Subscription,
  switchMap,
} from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { getOptionalUserId } from "@bitwarden/common/auth/services/account.service";
import { AutofillSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/autofill-settings.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { UriMatchStrategy } from "@bitwarden/common/models/domain/domain-service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";

import { BrowserApi } from "../../platform/browser/browser-api";

const webRequestUrlFilter: chrome.webRequest.RequestFilter = {
  urls: ["http://*/*", "https://*/*"],
};

/**
 * How long a held challenge waits for the user to answer the confirmation dialog
 * before it is left to the browser.
 */
const AUTH_CHALLENGE_CONFIRMATION_TIMEOUT_MS = 60_000;

export default class WebRequestBackground {
  private pendingAuthRequests: Set<string> = new Set<string>([]);
  private isFirefox: boolean;
  private listenersRegistered = false;
  private basicAuthResponseEnabledSubscription?: Subscription;

  constructor(
    platformUtilsService: PlatformUtilsService,
    private cipherService: CipherService,
    private authService: AuthService,
    private accountService: AccountService,
    private readonly webRequest: typeof chrome.webRequest,
    private configService: ConfigService,
    private autofillSettingsService: AutofillSettingsServiceAbstraction,
  ) {
    this.isFirefox = platformUtilsService.isFirefox();
  }

  /**
   * Keeps the handler that answers HTTP auth challenges with a matching vault credential
   * registered only while both the feature flag and the active user's setting allow it.
   *
   * While registered, `webRequest.onAuthRequired` fires for any request that receives a 401.
   */
  startListening() {
    this.basicAuthResponseEnabledSubscription?.unsubscribe();
    this.basicAuthResponseEnabledSubscription = this.basicAuthResponseEnabled$().subscribe(
      (basicAuthResponseEnabled) => {
        if (basicAuthResponseEnabled) {
          this.registerListeners();
        } else {
          this.unregisterListeners();
        }
      },
    );
  }

  /**
   * Emits `true` only when the feature flag is on and the active user has opted in.
   * Fails closed: no active user, or an error from either source, emits `false`.
   */
  private basicAuthResponseEnabled$(): Observable<boolean> {
    const userSettingEnabled$ = this.accountService.activeAccount$.pipe(
      getOptionalUserId,
      switchMap((userId) =>
        userId == null ? of(false) : this.autofillSettingsService.enableBasicAuthResponse$,
      ),
    );

    return combineLatest([
      this.configService.getFeatureFlag$(FeatureFlag.EnableBasicAuthResponse),
      userSettingEnabled$,
    ]).pipe(
      map(([featureFlagEnabled, userSettingEnabled]) => featureFlagEnabled && userSettingEnabled),
      catchError(() => of(false)),
      distinctUntilChanged(),
    );
  }

  private registerListeners() {
    if (this.listenersRegistered) {
      return;
    }

    this.webRequest.onAuthRequired.addListener(
      this.handleAuthRequired as any,
      webRequestUrlFilter,
      [this.isFirefox ? "blocking" : "asyncBlocking"],
    );
    this.webRequest.onCompleted.addListener(this.completeAuthRequest, webRequestUrlFilter);
    this.webRequest.onErrorOccurred.addListener(this.completeAuthRequest, webRequestUrlFilter);

    this.listenersRegistered = true;
  }

  private unregisterListeners() {
    if (!this.listenersRegistered) {
      return;
    }

    this.webRequest.onAuthRequired.removeListener(this.handleAuthRequired as any);
    this.webRequest.onCompleted.removeListener(this.completeAuthRequest);
    this.webRequest.onErrorOccurred.removeListener(this.completeAuthRequest);
    this.pendingAuthRequests.clear();

    this.listenersRegistered = false;
  }

  /**
   * Answers an auth challenge on both listener contracts: Chrome's `asyncBlocking`
   * passes a callback, while Firefox, which does not support `asyncBlocking`,
   * passes none and reads the promise this returns under `blocking`.
   */
  private handleAuthRequired = async (
    details: chrome.webRequest.OnAuthRequiredDetails,
    callback?: (response: chrome.webRequest.BlockingResponse) => void,
  ): Promise<chrome.webRequest.BlockingResponse> => {
    console.log("🚀 🚀 challenge request context:", {
      requestId: details.requestId,
      type: details.type,
      frameId: details.frameId,
      parentFrameId: details.parentFrameId,
      initiator: details.initiator,
      url: details.url,
      tabId: details.tabId,
    });
    const response = await this.getAuthChallengeResponse(details);

    if (callback) {
      callback(response);
    }

    return response;
  };

  /**
   * Resolves to the credentials of the single vault login matching the request
   * host once the user confirms, to a cancellation when the user declines, or to
   * an empty response that leaves the challenge to the browser.
   */
  private async getAuthChallengeResponse(
    details: chrome.webRequest.OnAuthRequiredDetails,
  ): Promise<chrome.webRequest.BlockingResponse> {
    if (!details.url || this.pendingAuthRequests.has(details.requestId)) {
      return {};
    }

    this.pendingAuthRequests.add(details.requestId);

    const activeUserId = await firstValueFrom(
      this.accountService.activeAccount$.pipe(getOptionalUserId),
    );

    if (activeUserId == null) {
      return {};
    }

    const authStatus = await firstValueFrom(this.authService.authStatusFor$(activeUserId));

    if (authStatus < AuthenticationStatus.Unlocked) {
      return {};
    }

    try {
      const ciphers = await this.cipherService.getAllDecryptedForUrl(
        details.url,
        activeUserId,
        undefined,
        UriMatchStrategy.Host,
      );

      if (ciphers == null || ciphers.length !== 1) {
        return {};
      }

      const username = ciphers[0].login?.username;
      const password = ciphers[0].login?.password;

      if (username == null || password == null) {
        return {};
      }

      const userConfirmed = await this.confirmAuthChallengeResponse(details.tabId, details.url);
      console.log("🚀 🚀 userConfirmed:", userConfirmed);

      if (userConfirmed == null) {
        return {};
      }

      if (!userConfirmed) {
        return { cancel: true };
      }

      return {
        authCredentials: {
          username,
          password,
        },
      };
    } catch {
      return {};
    }
  }

  /**
   * Proof of concept: asks the user, through a `confirm()` dialog injected into the
   * requesting tab, whether to answer the challenge with the matching vault login.
   *
   * The dialog runs in the tab's current document, which during a top-level
   * navigation is still the previous page, so the browser attributes the dialog
   * to that page's origin rather than to the challenger or the extension.
   *
   * Resolves to `null` when there is no tab, the dialog cannot be shown in it
   * (for example, a browser-internal page), or no answer arrives within
   * `AUTH_CHALLENGE_CONFIRMATION_TIMEOUT_MS`, so the browser handles the challenge.
   */
  private async confirmAuthChallengeResponse(tabId: number, url: string): Promise<boolean | null> {
    console.log("🚀 🚀 confirmAuthChallengeResponse tabId:", tabId);
    if (tabId == null || tabId < 0) {
      return null;
    }

    try {
      console.log("🚀 🚀 url:", url);
      const challengeHost = new URL(url).host;
      console.log("🚀 🚀 challengeHost:", challengeHost);

      // Diagnostic: inject a dialog-free function to tell whether injection itself
      // completes while the navigation is held on the challenge.
      const probeInjection = BrowserApi.executeFunctionInTab(tabId, () => document.URL, [], {
        injectImmediately: true,
      });
      const probeTimeout = new Promise((resolve) =>
        setTimeout(() => resolve("🚀 🚀 probe timed out after 5s"), 5000),
      );
      console.log("🚀 🚀 before probe inject");
      console.log("🚀 🚀 probe inject result:", await Promise.race([probeInjection, probeTimeout]));

      console.log("🚀 🚀 before confirm inject");
      const test = globalThis.confirm(`Bitwarden: sign in with the login saved for this site?`);
      console.log('🚀 🚀 test:', test);
      const confirmation = BrowserApi.executeFunctionInTab(
        tabId,
        (host: string) =>
          globalThis.confirm(`Bitwarden: sign in to ${host} with the login saved for this site?`),
        [challengeHost],
        { injectImmediately: true },
      );
      const confirmationTimeout = new Promise<null>((resolve) =>
        setTimeout(() => {
          console.log("🚀 🚀 confirmation timed out");
          resolve(null);
        }, AUTH_CHALLENGE_CONFIRMATION_TIMEOUT_MS),
      );
      const confirmed = await Promise.race([confirmation, confirmationTimeout]);
      console.log("🚀 🚀 confirm inject result:", confirmed);

      return typeof confirmed === "boolean" ? confirmed : null;
    } catch (caught) {
      console.log("🚀 🚀 inject threw:", caught);
      return null;
    }
  }

  private completeAuthRequest = (details: chrome.webRequest.WebRequestDetails) => {
    this.pendingAuthRequests.delete(details.requestId);
  };
}
