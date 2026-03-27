import {
  CompletionAction,
  EmailScrapeConfig,
  OAuthFlowInitiation,
  OAuthFlowState,
  OAuthSsoProvider,
} from "../abstractions/oauth-detection.background";

import { scrapeAppleEmailFromPage } from "./apple-email-scraper";

/** URL patterns that indicate an Apple OAuth flow. */
const APPLE_OAUTH_URL_FILTER: chrome.webRequest.RequestFilter = {
  urls: ["*://appleid.apple.com/auth/authorize*"],
  types: ["main_frame"],
};

/**
 * URL filter for Apple's sign-in page where we could scrape email.
 * TODO: Determine if email scraping is feasible on Apple's sign-in page.
 */
const APPLE_EMAIL_PAGE_FILTER: chrome.events.UrlFilter[] = [
  { hostEquals: "appleid.apple.com", pathContains: "auth/authorize" },
];

/** Request filter for Apple's consent endpoint — email appears on page after this returns. */
const APPLE_EMAIL_READY_REQUEST_FILTER: chrome.webRequest.RequestFilter = {
  urls: ["*://appleid.apple.com/appleauth/auth/oauth/consent*"],
  types: ["xmlhttprequest", "main_frame", "sub_frame"],
};

export class AppleOAuthProvider implements OAuthSsoProvider {
  readonly name = "Apple";
  readonly flowDetectionFilter = APPLE_OAUTH_URL_FILTER;
  readonly emailPageFilter = APPLE_EMAIL_PAGE_FILTER;
  readonly emailReadyRequestFilter = APPLE_EMAIL_READY_REQUEST_FILTER;

  extractFlowInitiation(
    details: chrome.webRequest.OnBeforeRequestDetails,
  ): OAuthFlowInitiation | null {
    let redirectUri: string | undefined;
    try {
      const oauthUrl = new URL(details.url);
      redirectUri = oauthUrl.searchParams.get("redirect_uri") ?? undefined;
    } catch {
      // continue without redirect_uri
    }

    return {
      ssoProvider: this.name,
      redirectUri,
      initiatorOrigin: details.initiator ?? undefined,
    };
  }

  shouldScrapeEmail(url: string): boolean {
    return url.includes("appleid.apple.com/auth/authorize");
  }

  getEmailScrapeConfig(): EmailScrapeConfig {
    return {
      scraperFunc: scrapeAppleEmailFromPage,
      retryDelaysMs: [0, 500, 1500],
    };
  }

  detectCompletion(navUrl: string, flow: OAuthFlowState): CompletionAction {
    if (!flow.redirectUri) {
      return CompletionAction.None;
    }

    // Apple uses response_mode=form_post — the auth code is POSTed, not in
    // URL params. Completion is simply navigation to the redirect_uri.
    try {
      const url = new URL(navUrl);
      const redirectBase = new URL(flow.redirectUri);
      if (url.origin === redirectBase.origin && url.pathname === redirectBase.pathname) {
        return CompletionAction.CompleteAndNotify;
      }
    } catch {
      // URL parsing failed
    }

    return CompletionAction.None;
  }
}
