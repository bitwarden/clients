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

const webRequestUrlFilter: chrome.webRequest.RequestFilter = {
  urls: ["http://*/*", "https://*/*"],
};

/**
 * Authentication schemes answered from the vault.
 *
 * `ntlm` and `negotiate` are excluded. They negotiate with operating system
 * credentials over a multi-message handshake rather than submitting a single
 * username and password, so answering them with a vault item hands the
 * challenger material the scheme was never meant to carry.
 */
const ANSWERABLE_AUTH_SCHEMES = new Set(["basic", "digest"]);

/**
 * Non-navigation request types answered from the vault, and then only when the
 * requesting page is the same origin as the challenger.
 *
 * Credentials are cached per protection space and sent preemptively once a
 * space has been authenticated, so a page's own assets do not raise a second
 * challenge. A passive asset such as an image or a stylesheet therefore only
 * reaches this code when it sits in a realm nothing has authenticated yet,
 * which no ordinary deployment produces. The two kept here do occur: a single
 * page application calling a protected API on its own origin, and a wrapper
 * page embedding an application that carries its own realm.
 */
const ANSWERABLE_SUBRESOURCE_TYPES = new Set(["xmlhttprequest", "sub_frame"]);

const DEFAULT_PORT_BY_PROTOCOL: Record<string, number> = {
  "http:": 80,
  "https:": 443,
};

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

/** `URL.hostname` brackets IPv6 literals while `challenger.host` does not. */
function normalizeHost(host: string): string {
  return host.replace(/^\[|\]$/g, "").toLowerCase();
}

function challengerIsRequestHost(
  challenger: chrome.webRequest.OnAuthRequiredDetails["challenger"],
  requestUrl: URL,
): boolean {
  if (challenger?.host == null) {
    return false;
  }

  if (normalizeHost(challenger.host) !== normalizeHost(requestUrl.hostname)) {
    return false;
  }

  // The port is compared only when the browser reports a usable one. Firefox
  // reports -1 rather than the scheme's default port, so treating an
  // unreadable value as a mismatch would reject challenges whose host already
  // matches. Proxy challenges, the case this comparison exists to catch, are
  // rejected by `isProxy` before reaching here.
  const challengerPort = Number(challenger.port);
  if (!Number.isInteger(challengerPort) || challengerPort <= 0) {
    return true;
  }

  const requestPort =
    requestUrl.port === ""
      ? DEFAULT_PORT_BY_PROTOCOL[requestUrl.protocol]
      : Number(requestUrl.port);

  return challengerPort === requestPort;
}

/** Fields Firefox supplies on this event that the Chrome typings do not describe. */
interface FirefoxAuthRequiredDetails {
  originUrl?: string;
  documentUrl?: string;
}

/**
 * The origin of the context that issued the request, or null when the browser
 * did not report one.
 *
 * Chrome supplies a bare origin in `initiator`. Firefox instead supplies the
 * full URL of the initiating document in `originUrl`, with `documentUrl` naming
 * the document the resource loads into.
 */
function getInitiatorOrigin(details: chrome.webRequest.OnAuthRequiredDetails): string | null {
  const firefoxDetails = details as FirefoxAuthRequiredDetails;
  const initiator = details.initiator ?? firefoxDetails.originUrl ?? firefoxDetails.documentUrl;

  // An opaque initiator serializes as the string "null" and cannot be compared.
  if (initiator == null || initiator === "null") {
    return null;
  }

  return parseUrl(initiator)?.origin ?? null;
}

function isTopLevelNavigationOrSameOriginSubresource(
  details: chrome.webRequest.OnAuthRequiredDetails,
  requestUrl: URL,
): boolean {
  if (details.type === "main_frame") {
    return true;
  }

  if (!ANSWERABLE_SUBRESOURCE_TYPES.has(details.type)) {
    return false;
  }

  return getInitiatorOrigin(details) === requestUrl.origin;
}

/**
 * Decides whether a challenge is one the extension answers from the vault.
 *
 * Every branch fails closed, so a challenge that cannot be attributed with
 * confidence is left for the browser to handle.
 */
export function shouldAnswerAuthChallenge(
  details: chrome.webRequest.OnAuthRequiredDetails,
): boolean {
  // On a 407 the challenge comes from the proxy while `url` stays the
  // destination, so a credential matched against the destination would be
  // delivered to whoever is proxying the connection.
  if (details.isProxy) {
    return false;
  }

  const scheme = details.scheme?.toLowerCase() ?? "";
  if (!ANSWERABLE_AUTH_SCHEMES.has(scheme)) {
    return false;
  }

  // A request with no owning tab is not something the user is looking at.
  if (details.tabId == null || details.tabId < 0) {
    return false;
  }

  const requestUrl = parseUrl(details.url);
  if (requestUrl == null) {
    return false;
  }

  // The credential is matched against the request URL, so the party issuing the
  // challenge has to be that same host.
  if (!challengerIsRequestHost(details.challenger, requestUrl)) {
    return false;
  }

  // A page can reference any URL as a subresource, and those requests are issued
  // without the user acting. Answering them releases a credential for a host the
  // user never navigated to. A page loading its own protected subresources is
  // the one subresource case that survives.
  return isTopLevelNavigationOrSameOriginSubresource(details, requestUrl);
}

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
    const response = await this.getAuthChallengeResponse(details);

    if (callback) {
      callback(response);
    }

    return response;
  };

  /**
   * Resolves to the credentials of the single vault login matching the request
   * host, or to an empty response that leaves the challenge to the browser.
   */
  private async getAuthChallengeResponse(
    details: chrome.webRequest.OnAuthRequiredDetails,
  ): Promise<chrome.webRequest.BlockingResponse> {
    if (
      !details.url ||
      this.pendingAuthRequests.has(details.requestId) ||
      !shouldAnswerAuthChallenge(details)
    ) {
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

  private completeAuthRequest = (details: chrome.webRequest.WebRequestDetails) => {
    this.pendingAuthRequests.delete(details.requestId);
  };
}
