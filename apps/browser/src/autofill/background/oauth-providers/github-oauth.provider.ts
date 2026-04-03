import {
  CompletionAction,
  EmailScrapeConfig,
  OAuthFlowInitiation,
  OAuthFlowState,
  OAuthSsoProvider,
} from "../abstractions/oauth-detection.background";

import { scrapeGitHubUsernameFromPage } from "./github-email-scraper";

/** URL patterns that indicate a GitHub OAuth flow. */
const GITHUB_OAUTH_URL_FILTER: chrome.webRequest.RequestFilter = {
  urls: ["*://github.com/login/oauth/authorize*"],
  types: ["main_frame", "sub_frame"],
};

/** URL filter for GitHub pages where we scrape username. */
const GITHUB_EMAIL_PAGE_FILTER: chrome.events.UrlFilter[] = [
  { hostEquals: "github.com", pathContains: "login/oauth/authorize" },
];

export class GitHubOAuthProvider implements OAuthSsoProvider {
  readonly name = "GitHub";
  readonly flowDetectionFilter = GITHUB_OAUTH_URL_FILTER;
  readonly emailPageFilter = GITHUB_EMAIL_PAGE_FILTER;

  extractFlowInitiation(
    details: chrome.webRequest.OnBeforeRequestDetails,
  ): OAuthFlowInitiation | null {
    let redirectUri: string | undefined;
    const initiatorOrigin = details.initiator ?? undefined;

    try {
      const oauthUrl = new URL(details.url);
      redirectUri = oauthUrl.searchParams.get("redirect_uri") ?? undefined;
    } catch {
      // URL parsing failed — continue without redirect_uri
    }

    return {
      ssoProvider: this.name,
      redirectUri,
      initiatorOrigin,
    };
  }

  shouldScrapeEmail(url: string): boolean {
    return url.includes("github.com/login/oauth/authorize");
  }

  getEmailScrapeConfig(): EmailScrapeConfig {
    return {
      scraperFunc: scrapeGitHubUsernameFromPage,
      retryDelaysMs: [0, 1500, 3000],
    };
  }

  detectCompletion(navUrl: string, flow: OAuthFlowState): CompletionAction {
    // Check standard HTTP redirect with code
    if (this.isOAuthSuccessRedirect(navUrl, flow)) {
      return CompletionAction.CompleteAndNotify;
    }

    // Same-tab flow: navigation back to the origin site (leaving GitHub)
    if (this.isReturnToOrigin(navUrl, flow)) {
      return CompletionAction.CompleteAndNotify;
    }

    return CompletionAction.None;
  }

  /**
   * Standard OAuth redirect: navigation to redirect_uri with code=.
   */
  private isOAuthSuccessRedirect(navUrl: string, flow: OAuthFlowState): boolean {
    try {
      const url = new URL(navUrl);

      if (!url.searchParams.has("code")) {
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
   * Same-tab flow: navigation back to the origin site indicates the
   * OAuth flow completed and GitHub redirected back.
   */
  private isReturnToOrigin(navUrl: string, flow: OAuthFlowState): boolean {
    if (!flow.originUrl || !navUrl.startsWith("http")) {
      return false;
    }

    // Don't match navigations still on GitHub
    if (navUrl.includes("github.com")) {
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
