import {
  AccountSelectionConfig,
  CompletionAction,
  EmailScrapeConfig,
  OAuthFlowInitiation,
  OAuthFlowState,
  OAuthSsoProvider,
} from "../abstractions/oauth-detection.background";

import { googleAccountSelectionListener } from "./google-account-selection";
import { scrapeGoogleEmailFromPage } from "./google-email-scraper";

/** URL patterns that indicate a Google OAuth flow. */
const GOOGLE_OAUTH_URL_FILTER: chrome.webRequest.RequestFilter = {
  urls: ["*://accounts.google.com/o/oauth2/*", "*://accounts.google.com/v3/signin/*"],
  types: ["main_frame", "sub_frame"],
};

/** URL filter for the Google consent/identity page where we scrape email. */
const GOOGLE_EMAIL_PAGE_FILTER: chrome.events.UrlFilter[] = [
  { hostEquals: "accounts.google.com", pathContains: "signin/oauth" },
];

const GOOGLE_SIGNIN_CONSENT_PATTERN = "accounts.google.com/signin/oauth";

/** URL filter for Google's account chooser page. */
const GOOGLE_ACCOUNT_CHOOSER_FILTER: chrome.events.UrlFilter[] = [
  { hostEquals: "accounts.google.com", pathContains: "signin/accountchooser" },
  { hostEquals: "accounts.google.com", pathContains: "signin/identifier" },
];

export class GoogleOAuthProvider implements OAuthSsoProvider {
  readonly name = "Google";
  readonly flowDetectionFilter = GOOGLE_OAUTH_URL_FILTER;
  readonly emailPageFilter = GOOGLE_EMAIL_PAGE_FILTER;
  readonly accountSelectionConfig: AccountSelectionConfig = {
    pageFilter: GOOGLE_ACCOUNT_CHOOSER_FILTER,
    injectedFunc: googleAccountSelectionListener,
  };

  extractFlowInitiation(
    details: chrome.webRequest.OnBeforeRequestDetails,
  ): OAuthFlowInitiation | null {
    let redirectUri: string | undefined;
    try {
      const oauthUrl = new URL(details.url);
      redirectUri = oauthUrl.searchParams.get("redirect_uri") ?? undefined;
    } catch {
      // URL parsing failed — continue without redirect_uri
    }

    return {
      ssoProvider: this.name,
      redirectUri,
      initiatorOrigin: details.initiator ?? undefined,
    };
  }

  shouldScrapeEmail(url: string): boolean {
    return url.includes(GOOGLE_SIGNIN_CONSENT_PATTERN);
  }

  getEmailScrapeConfig(): EmailScrapeConfig {
    return {
      scraperFunc: scrapeGoogleEmailFromPage,
      retryDelaysMs: [0, 1500, 3000],
    };
  }

  detectCompletion(navUrl: string, flow: OAuthFlowState): CompletionAction {
    // Check standard HTTP redirect with code/token
    if (this.isOAuthSuccessRedirect(navUrl, flow)) {
      return CompletionAction.CompleteAndNotify;
    }

    // Check storagerelay:// popup flow (Google Identity Services)
    if (this.isStorageRelayApproval(navUrl, flow)) {
      return CompletionAction.CompleteAndWaitForTabClose;
    }

    // Same-tab flow: navigation back to the origin site (leaving Google).
    // Handles cases where the callback redirect is a server-side 302 that
    // onBeforeNavigate doesn't catch (e.g. GitHub's Google OAuth).
    if (this.isReturnToOrigin(navUrl, flow)) {
      return CompletionAction.CompleteAndNotify;
    }

    return CompletionAction.None;
  }

  /**
   * Standard OAuth redirect: navigation to redirect_uri with code= or access_token=.
   */
  private isOAuthSuccessRedirect(navUrl: string, flow: OAuthFlowState): boolean {
    try {
      const url = new URL(navUrl);

      const hasCode = url.searchParams.has("code");
      const hasToken = url.searchParams.has("access_token") || url.hash.includes("access_token=");

      if (!hasCode && !hasToken) {
        return false;
      }

      if (!flow.redirectUri) {
        return false;
      }

      const redirectBase = new URL(flow.redirectUri);
      return url.origin === redirectBase.origin && url.pathname === redirectBase.pathname;
    } catch {
      return false;
    }
  }

  /**
   * For non-redirect flows (storagerelay:// or gis_transform): the auth
   * code/token is sent via postMessage, not navigation. Completion is
   * signaled by navigation to Google's consent processing URL after the
   * user clicks "Allow".
   */
  private isStorageRelayApproval(navUrl: string, flow: OAuthFlowState): boolean {
    const isNonRedirectFlow =
      flow.redirectUri?.startsWith("storagerelay://") || flow.redirectUri === "gis_transform";
    if (!isNonRedirectFlow) {
      return false;
    }

    if (!flow.email) {
      return false;
    }

    return (
      navUrl.includes("accounts.google.com/signin/oauth/consent") &&
      navUrl.includes("flowName=GeneralOAuthFlow")
    );
  }

  /**
   * Same-tab flow: navigation back to the origin site indicates the
   * OAuth flow completed and Google redirected back.
   */
  private isReturnToOrigin(navUrl: string, flow: OAuthFlowState): boolean {
    if (!flow.originUrl || !navUrl.startsWith("http")) {
      return false;
    }

    // Don't match navigations still on Google
    if (navUrl.includes("accounts.google.com")) {
      return false;
    }

    try {
      const navOrigin = new URL(navUrl).origin;
      const flowOrigin = new URL(flow.originUrl).origin;
      return navOrigin === flowOrigin;
    } catch {
      return false;
    }
  }
}
