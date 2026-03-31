import {
  CompletionAction,
  EmailScrapeConfig,
  OAuthFlowInitiation,
  OAuthFlowState,
  OAuthSsoProvider,
} from "../abstractions/oauth-detection.background";

import { scrapeFacebookNameFromPage } from "./facebook-email-scraper";

/** URL patterns that indicate a Facebook OAuth flow initiation. */
const FACEBOOK_OAUTH_URL_FILTER: chrome.webRequest.RequestFilter = {
  urls: ["*://www.facebook.com/login.php*", "*://www.facebook.com/v*/dialog/oauth*"],
  types: ["main_frame", "sub_frame"],
};

/** URL filter for Facebook pages where we can scrape the user's name. */
const FACEBOOK_EMAIL_PAGE_FILTER: chrome.events.UrlFilter[] = [
  { hostEquals: "www.facebook.com", pathContains: "privacy/consent" },
  { hostEquals: "www.facebook.com", pathContains: "dialog/consent" },
  { hostEquals: "www.facebook.com", pathContains: "dialog/oauth" },
];

export class FacebookOAuthProvider implements OAuthSsoProvider {
  readonly name = "Facebook";
  readonly flowDetectionFilter = FACEBOOK_OAUTH_URL_FILTER;
  readonly emailPageFilter = FACEBOOK_EMAIL_PAGE_FILTER;

  extractFlowInitiation(
    details: chrome.webRequest.OnBeforeRequestDetails,
  ): OAuthFlowInitiation | null {
    try {
      const url = new URL(details.url);

      // For login.php: the redirect_uri is nested inside the `next` param
      // which contains the OAuth dialog URL
      let redirectUri: string | undefined;
      const nextParam = url.searchParams.get("next");
      if (nextParam) {
        try {
          const nextUrl = new URL(nextParam);
          redirectUri = nextUrl.searchParams.get("redirect_uri") ?? undefined;
        } catch {
          // Couldn't parse nested URL
        }
      }

      // Direct redirect_uri (for /dialog/oauth URLs)
      if (!redirectUri) {
        redirectUri = url.searchParams.get("redirect_uri") ?? undefined;
      }

      return {
        ssoProvider: this.name,
        redirectUri,
        initiatorOrigin: details.initiator ?? undefined,
      };
    } catch {
      return null;
    }
  }

  shouldScrapeEmail(url: string): boolean {
    return (
      url.includes("facebook.com/privacy/consent") ||
      url.includes("facebook.com/dialog/consent") ||
      url.includes("facebook.com/dialog/oauth")
    );
  }

  getEmailScrapeConfig(): EmailScrapeConfig {
    return {
      scraperFunc: scrapeFacebookNameFromPage,
      retryDelaysMs: [0, 1000, 2000],
    };
  }

  detectCompletion(navUrl: string, flow: OAuthFlowState): CompletionAction {
    // Facebook's consent completion page — the user approved permissions
    // and Facebook is finalizing. The popup will close after this.
    if (navUrl.includes("facebook.com/dialog/consent/complete")) {
      return CompletionAction.CompleteAndWaitForTabClose;
    }

    // Facebook's privacy consent page — the final confirmation step
    if (navUrl.includes("facebook.com/privacy/consent/") && navUrl.includes("flow=gdp")) {
      return CompletionAction.CompleteAndWaitForTabClose;
    }

    // Standard redirect_uri match with token/code in URL
    if (this.isDirectRedirect(navUrl, flow)) {
      return CompletionAction.CompleteAndNotify;
    }

    // Same-tab flow: navigation back to the origin site (leaving Facebook)
    if (this.isReturnToOrigin(navUrl, flow)) {
      return CompletionAction.CompleteAndNotify;
    }

    return CompletionAction.None;
  }

  /**
   * Fallback: standard redirect_uri match with token/code in URL.
   */
  private isDirectRedirect(navUrl: string, flow: OAuthFlowState): boolean {
    if (!flow.redirectUri) {
      return false;
    }

    try {
      const url = new URL(navUrl);
      const redirectBase = new URL(flow.redirectUri);

      if (url.origin !== redirectBase.origin || url.pathname !== redirectBase.pathname) {
        return false;
      }

      const hasToken =
        url.searchParams.has("access_token") ||
        url.searchParams.has("code") ||
        url.hash.includes("access_token=");

      return hasToken;
    } catch {
      return false;
    }
  }

  /**
   * Same-tab flow: detects navigation back to the origin site.
   */
  private isReturnToOrigin(navUrl: string, flow: OAuthFlowState): boolean {
    if (!flow.originUrl || !navUrl.startsWith("http")) {
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
