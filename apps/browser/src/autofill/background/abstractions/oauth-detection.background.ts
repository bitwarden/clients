/**
 * Result returned by a provider's email scraper function.
 * The scraper runs inside chrome.scripting.executeScript so it must be
 * a standalone function with no closures.
 */
export type EmailScrapeResult = {
  email: string | null;
  debug: string;
};

/**
 * Tracks an in-progress SSO/OAuth flow for a single tab.
 */
export type OAuthFlowState = {
  /** The tab that initiated the OAuth flow (the relying-party site). */
  originTab: chrome.tabs.Tab;
  /** URL of the relying-party site that started the flow. */
  originUrl: string;
  /** SSO provider identifier (e.g. "Google"). */
  ssoProvider: string;
  /** Email address scraped from the SSO consent screen, if available. */
  email?: string;
  /** The redirect_uri from the OAuth request. */
  redirectUri?: string;
  /** Whether the OAuth flow completed successfully. */
  completed: boolean;
};

/**
 * Information extracted when a provider detects an OAuth flow initiation.
 */
export type OAuthFlowInitiation = {
  /** SSO provider display name (e.g. "Google"). */
  ssoProvider: string;
  /** The redirect_uri extracted from the OAuth URL, if present. */
  redirectUri?: string;
  /** The initiator origin, if available from the request details. */
  initiatorOrigin?: string;
};

/**
 * Configuration for email scraping: the provider supplies the
 * function to execute and a retry schedule.
 */
export type EmailScrapeConfig = {
  /**
   * Standalone function to execute via chrome.scripting.executeScript.
   * Must have no closures over outer variables.
   */
  scraperFunc: () => EmailScrapeResult;
  /** Delays in ms for each scrape attempt (e.g. [0, 1500, 3000]). */
  retryDelaysMs: number[];
};

/**
 * Result of a provider's flow completion check.
 */
export const CompletionAction = Object.freeze({
  /** Not a completion event — ignore. */
  None: "none",
  /** Flow completed — trigger notification immediately. */
  CompleteAndNotify: "complete-and-notify",
  /** Flow completed — mark complete but wait for tab close to notify. */
  CompleteAndWaitForTabClose: "complete-and-wait-for-tab-close",
} as const);

export type CompletionAction = (typeof CompletionAction)[keyof typeof CompletionAction];

/**
 * Contract that each SSO/OAuth provider must implement.
 *
 * Providers encapsulate:
 * - Which URLs trigger flow detection
 * - How to extract flow initiation data from a request
 * - Which URLs trigger email scraping and how to scrape
 * - How to determine whether a navigation constitutes flow completion
 */
export interface OAuthSsoProvider {
  /** Human-readable name for logging (e.g. "Google"). */
  readonly name: string;

  /** URL filter for chrome.webRequest.onBeforeRequest to detect OAuth flow initiation. */
  readonly flowDetectionFilter: chrome.webRequest.RequestFilter;

  /** URL filter for chrome.webNavigation.onCompleted to detect the consent/email page. */
  readonly emailPageFilter: chrome.events.UrlFilter[];

  /**
   * Optional URL filter for chrome.webRequest.onCompleted. When a matching
   * request completes, the orchestrator triggers email scraping. Use this
   * when the email only appears on the page after a specific API request
   * returns (e.g. Apple's consent endpoint). If undefined, email scraping
   * is triggered by emailPageFilter navigation instead.
   */
  readonly emailReadyRequestFilter?: chrome.webRequest.RequestFilter;

  /**
   * Given a webRequest that matched flowDetectionFilter, extract
   * flow initiation data. Return null to skip this request.
   */
  extractFlowInitiation(
    details: chrome.webRequest.OnBeforeRequestDetails,
  ): OAuthFlowInitiation | null;

  /**
   * Given a navigation that matched emailPageFilter, confirm whether
   * email scraping should proceed. Allows additional URL validation
   * beyond the filter.
   */
  shouldScrapeEmail(url: string): boolean;

  /** Return the scraper configuration for email extraction. */
  getEmailScrapeConfig(): EmailScrapeConfig;

  /**
   * Evaluate whether a navigation URL represents OAuth flow completion.
   *
   * @param navUrl - The URL the SSO tab is navigating to
   * @param flow - Current flow state (includes redirectUri, email, etc.)
   * @returns The action the orchestrator should take
   */
  detectCompletion(navUrl: string, flow: OAuthFlowState): CompletionAction;
}
