import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { BrowserApi } from "../../platform/browser/browser-api";

import {
  CompletionAction,
  EmailScrapeResult,
  OAuthFlowState,
  OAuthSsoProvider,
} from "./abstractions/oauth-detection.background";
import NotificationBackground from "./notification.background";

export class OAuthDetectionBackground {
  /** Maps SSO tab ID → flow state. */
  private activeFlows = new Map<number, OAuthFlowState>();
  /** Maps SSO tab ID → pending resolveOriginTab promise. */
  private pendingResolves = new Map<number, Promise<void>>();

  constructor(
    private logService: LogService,
    private notificationBackground: NotificationBackground,
    private providers: OAuthSsoProvider[],
  ) {}

  init() {
    this.logService.info("[OAuthDetection] ========================================");
    this.logService.info(
      "[OAuthDetection] Initializing OAuth detection service (v3 — provider abstraction)...",
    );

    // Register per-provider listeners
    for (const provider of this.providers) {
      this.registerProviderListeners(provider);
    }

    // DEBUG: Log all navigations to capture URL patterns for new providers
    chrome.webNavigation.onCompleted.addListener((details) => {
      if (details.frameId === 0) {
        this.logService.info(
          `[OAuthDetection][DEBUG] Navigation: tabId=${details.tabId} url=${details.url}`,
        );
      }
    });

    // Global listeners (not provider-specific)
    chrome.tabs.onRemoved.addListener(this.handleTabRemoved);
    this.logService.info("[OAuthDetection] Tab close listener ready");

    chrome.webNavigation.onBeforeNavigate.addListener(this.handleNavBeforeNavigate);
    this.logService.info("[OAuthDetection] Navigation completion listener ready");

    this.logService.info(
      `[OAuthDetection] Initialization complete — ${this.providers.length} provider(s): ` +
        this.providers.map((p) => p.name).join(", "),
    );
    this.logService.info("[OAuthDetection] ========================================");
  }

  private registerProviderListeners(provider: OAuthSsoProvider): void {
    // Flow detection: webRequest listener with provider-specific URL filter
    chrome.webRequest.onBeforeRequest.addListener((details) => {
      this.handleOAuthRequest(provider, details);
      return undefined;
    }, provider.flowDetectionFilter);
    this.logService.info(`[OAuthDetection] [${provider.name}] Flow detection listener ready`);

    // Email page detection: webNavigation listener with provider-specific URL filter
    chrome.webNavigation.onCompleted.addListener(
      (details) => this.handleNavCompleted(provider, details),
      { url: provider.emailPageFilter },
    );
    this.logService.info(`[OAuthDetection] [${provider.name}] Email page listener ready`);

    // Email ready request: some providers (e.g. Apple) only show the email
    // after a specific API request completes. Listen for that request and
    // trigger scraping when it finishes.
    if (provider.emailReadyRequestFilter) {
      chrome.webRequest.onCompleted.addListener(
        (details) => this.handleEmailReadyRequest(provider, details),
        provider.emailReadyRequestFilter,
      );
      this.logService.info(
        `[OAuthDetection] [${provider.name}] Email ready request listener ready`,
      );
    }
  }

  /**
   * Step 1: An OAuth request was detected by a provider's URL filter.
   */
  private handleOAuthRequest(
    provider: OAuthSsoProvider,
    details: chrome.webRequest.OnBeforeRequestDetails,
  ): void {
    this.logService.info(
      `[OAuthDetection][Step1] [${provider.name}] webRequest fired — ` +
        `tabId=${details.tabId}, url=${details.url}, type=${details.type}`,
    );

    if (details.tabId < 0) {
      this.logService.info(
        `[OAuthDetection][Step1] Ignoring: tabId ${details.tabId} is invalid (background request)`,
      );
      return;
    }

    if (this.activeFlows.has(details.tabId)) {
      this.logService.info(
        `[OAuthDetection][Step1] Ignoring: already tracking tab ${details.tabId}`,
      );
      return;
    }

    const initiation = provider.extractFlowInitiation(details);
    if (!initiation) {
      this.logService.info(
        `[OAuthDetection][Step1] [${provider.name}] Provider returned null — skipping`,
      );
      return;
    }

    this.logService.info(
      `[OAuthDetection][Step1] [${provider.name}] NEW OAuth flow detected ` +
        `in tab ${details.tabId}, initiator="${initiation.initiatorOrigin ?? "unknown"}", ` +
        `redirect_uri="${initiation.redirectUri ?? "unknown"}"`,
    );

    const promise = this.resolveOriginTab(
      details.tabId,
      initiation.initiatorOrigin ?? "unknown",
      initiation.redirectUri,
      initiation.ssoProvider,
    );
    this.pendingResolves.set(details.tabId, promise);
    void promise.finally(() => this.pendingResolves.delete(details.tabId));
  }

  /**
   * Finds the tab that initiated the OAuth flow.
   * Strategy A: openerTabId. Strategy B: query by initiator origin.
   */
  private async resolveOriginTab(
    ssoTabId: number,
    initiatorOrigin: string,
    redirectUri: string | undefined,
    ssoProvider: string,
  ): Promise<void> {
    this.logService.info(
      `[OAuthDetection][ResolveOrigin] Looking up origin tab for SSO tab ${ssoTabId}...`,
    );

    try {
      const ssoTab = await BrowserApi.getTab(ssoTabId);
      if (!ssoTab) {
        this.logService.info(
          `[OAuthDetection][ResolveOrigin] Could not get SSO tab ${ssoTabId} — tab may have closed`,
        );
        return;
      }

      this.logService.info(
        `[OAuthDetection][ResolveOrigin] SSO tab info: ` +
          `id=${ssoTab.id}, url="${ssoTab.url}", openerTabId=${ssoTab.openerTabId ?? "none"}`,
      );

      let originTab: chrome.tabs.Tab | undefined;

      // Strategy A: Use openerTabId
      if (ssoTab.openerTabId != null) {
        this.logService.info(
          `[OAuthDetection][ResolveOrigin] Strategy A: trying openerTabId=${ssoTab.openerTabId}`,
        );
        originTab = await BrowserApi.getTab(ssoTab.openerTabId);
        if (originTab) {
          this.logService.info(
            `[OAuthDetection][ResolveOrigin] Strategy A SUCCESS: ` +
              `opener tab ${originTab.id}, url="${originTab.url}"`,
          );
        } else {
          this.logService.info(
            `[OAuthDetection][ResolveOrigin] Strategy A FAILED: opener tab not found`,
          );
        }
      }

      // Strategy B: Search by initiator origin
      if (!originTab && initiatorOrigin !== "unknown") {
        this.logService.info(
          `[OAuthDetection][ResolveOrigin] Strategy B: searching tabs matching "${initiatorOrigin}/*"`,
        );
        const tabs = await chrome.tabs.query({ url: `${initiatorOrigin}/*` });
        this.logService.info(
          `[OAuthDetection][ResolveOrigin] Strategy B: found ${tabs.length} matching tab(s): ` +
            tabs.map((t) => `{id=${t.id}, url="${t.url}"}`).join(", "),
        );
        originTab = tabs.find((t) => t.id !== ssoTabId);
        if (originTab) {
          this.logService.info(
            `[OAuthDetection][ResolveOrigin] Strategy B SUCCESS: ` +
              `matched tab ${originTab.id}, url="${originTab.url}"`,
          );
        } else {
          this.logService.info(
            `[OAuthDetection][ResolveOrigin] Strategy B FAILED: no matching tab (excluding SSO tab)`,
          );
        }
      }

      // Strategy C: Same-tab redirect flow (e.g. Apple OAuth).
      // The SSO tab IS the origin tab — use the initiator origin as the URL
      // since the tab has already navigated to the SSO provider.
      if (!originTab && initiatorOrigin !== "unknown") {
        this.logService.info(
          `[OAuthDetection][ResolveOrigin] Strategy C: same-tab flow — ` +
            `using SSO tab ${ssoTabId} as origin with initiator URL "${initiatorOrigin}"`,
        );
        originTab = ssoTab;
      }

      if (!originTab) {
        this.logService.info(
          `[OAuthDetection][ResolveOrigin] FAILED: could not resolve origin tab for SSO tab ${ssoTabId}. ` +
            `No notification will be shown.`,
        );
        return;
      }

      // For same-tab flows, the tab URL is now the SSO provider's URL,
      // so use the initiator origin as the origin URL.
      const isSameTabFlow = originTab.id === ssoTabId;
      const originUrl = isSameTabFlow ? initiatorOrigin : (originTab.url ?? initiatorOrigin);

      const flowState: OAuthFlowState = {
        originTab,
        originUrl,
        ssoProvider,
        redirectUri,
        completed: false,
      };
      this.activeFlows.set(ssoTabId, flowState);

      this.logService.info(
        `[OAuthDetection][ResolveOrigin] TRACKING: SSO tab ${ssoTabId} -> ` +
          `origin tab ${originTab.id} (${flowState.originUrl}), provider=${flowState.ssoProvider}`,
      );
      this.logService.info(
        `[OAuthDetection] Active flows: ${this.activeFlows.size} ` +
          `[${Array.from(this.activeFlows.keys()).join(", ")}]`,
      );
    } catch (e) {
      this.logService.error(`[OAuthDetection][ResolveOrigin] Error: ${e}`);
    }
  }

  /**
   * Step 2: A provider's email page filter matched. Scrape the email.
   */
  private handleNavCompleted = async (
    provider: OAuthSsoProvider,
    details: chrome.webNavigation.WebNavigationFramedCallbackDetails,
  ): Promise<void> => {
    this.logService.info(
      `[OAuthDetection][Step2] [${provider.name}] webNavigation.onCompleted fired — ` +
        `tabId=${details.tabId}, frameId=${details.frameId}, url=${details.url}`,
    );

    if (details.tabId < 0 || details.frameId !== 0) {
      this.logService.info(
        `[OAuthDetection][Step2] Ignoring: ` +
          `${details.tabId < 0 ? "invalid tabId" : `non-main frame (frameId=${details.frameId})`}`,
      );
      return;
    }

    if (!provider.shouldScrapeEmail(details.url)) {
      this.logService.info(
        `[OAuthDetection][Step2] [${provider.name}] URL did not pass provider validation`,
      );
      return;
    }

    // Wait for any in-flight resolveOriginTab from Step 1 to finish
    const pending = this.pendingResolves.get(details.tabId);
    if (pending !== undefined) {
      this.logService.info(`[OAuthDetection][Step2] Waiting for pending origin tab resolution...`);
      await pending;
    }

    const hasFlow = this.activeFlows.has(details.tabId);
    this.logService.info(
      `[OAuthDetection][Step2] [${provider.name}] Consent page detected! ` +
        `tab=${details.tabId}, hasExistingFlow=${hasFlow}`,
    );

    if (!hasFlow) {
      this.logService.info(
        `[OAuthDetection][Step2] No existing flow — starting origin tab resolution now`,
      );
      await this.resolveOriginTab(details.tabId, "unknown", undefined, provider.name);
    }

    // If the provider uses emailReadyRequestFilter, scraping is triggered
    // by that request completing instead of the page navigation.
    if (provider.emailReadyRequestFilter) {
      this.logService.info(
        `[OAuthDetection][Step2] [${provider.name}] Deferring scrape — waiting for emailReadyRequest`,
      );
      return;
    }

    this.triggerEmailScrape(details.tabId, provider);
  };

  /**
   * Step 2b: A provider's emailReadyRequestFilter matched — the API request
   * that populates the email on the page has completed. Trigger scraping.
   */
  private handleEmailReadyRequest = (
    provider: OAuthSsoProvider,
    details: chrome.webRequest.OnCompletedDetails,
  ): void => {
    if (details.tabId < 0) {
      return;
    }

    const flow = this.activeFlows.get(details.tabId);
    if (!flow || flow.email) {
      return;
    }

    this.logService.info(
      `[OAuthDetection][Step2b] [${provider.name}] Email ready request completed — ` +
        `tabId=${details.tabId}, url=${details.url}`,
    );

    this.triggerEmailScrape(details.tabId, provider);
  };

  /**
   * Schedules email scraping attempts using the provider's config.
   */
  private triggerEmailScrape(tabId: number, provider: OAuthSsoProvider): void {
    const config = provider.getEmailScrapeConfig();
    for (let i = 0; i < config.retryDelaysMs.length; i++) {
      const delay = config.retryDelaysMs[i];
      const attempt = i + 1;
      if (delay === 0) {
        this.scrapeEmailFromTab(tabId, config.scraperFunc, attempt);
      } else {
        setTimeout(() => this.scrapeEmailFromTab(tabId, config.scraperFunc, attempt), delay);
      }
    }
  }

  /**
   * Executes a provider-supplied scraper function in the target tab via
   * chrome.scripting.executeScript.
   */
  private scrapeEmailFromTab(
    tabId: number,
    scraperFunc: () => EmailScrapeResult,
    attempt: number,
  ): void {
    const flow = this.activeFlows.get(tabId);
    if (flow?.email) {
      this.logService.info(
        `[OAuthDetection][Step2] Attempt ${attempt}: skipping — email already captured`,
      );
      return;
    }

    this.logService.info(
      `[OAuthDetection][Step2] Attempt ${attempt}: executing DOM scrape in tab ${tabId}...`,
    );

    chrome.scripting
      .executeScript({
        target: { tabId },
        func: scraperFunc,
      })
      .then((results) => {
        this.logService.info(
          `[OAuthDetection][Step2] Attempt ${attempt} raw results: ${JSON.stringify(results)}`,
        );
        const result = results?.[0]?.result;
        this.logService.info(
          `[OAuthDetection][Step2] Attempt ${attempt} parsed: ` +
            `email="${result?.email ?? "null"}", debug="${result?.debug ?? "no debug"}"`,
        );

        if (!result?.email) {
          this.logService.info(`[OAuthDetection][Step2] Attempt ${attempt}: no email found yet`);
          return;
        }

        const currentFlow = this.activeFlows.get(tabId);
        if (!currentFlow) {
          this.logService.info(
            `[OAuthDetection][Step2] Attempt ${attempt}: got email "${result.email}" ` +
              `but no active flow for tab ${tabId}. ` +
              `Active flows: [${Array.from(this.activeFlows.keys()).join(", ")}]`,
          );
          return;
        }

        if (currentFlow.email) {
          this.logService.info(
            `[OAuthDetection][Step2] Attempt ${attempt}: email already set to "${currentFlow.email}", skipping`,
          );
          return;
        }

        currentFlow.email = result.email;
        this.logService.info(
          `[OAuthDetection][Step2] EMAIL CAPTURED on attempt ${attempt}: "${result.email}" ` +
            `for SSO flow tab ${tabId} -> origin ${currentFlow.originUrl}`,
        );
      })
      .catch((e) => {
        this.logService.error(
          `[OAuthDetection][Step2] Attempt ${attempt} FAILED for tab ${tabId}: ${e}`,
        );
      });
  }

  /**
   * Step 3: SSO tab was closed. Only trigger save if the flow was
   * already marked as completed.
   */
  private handleTabRemoved = (tabId: number): void => {
    const flow = this.activeFlows.get(tabId);
    if (!flow) {
      return;
    }

    this.activeFlows.delete(tabId);

    this.logService.info(
      `[OAuthDetection][Step3] SSO tab ${tabId} CLOSED — ` +
        `completed=${flow.completed}, email="${flow.email ?? "NOT CAPTURED"}", ` +
        `origin=${flow.originUrl}, provider=${flow.ssoProvider}`,
    );
    this.logService.info(`[OAuthDetection] Active flows after removal: ${this.activeFlows.size}`);

    if (flow.completed) {
      this.triggerSaveNotification(flow);
    } else {
      this.logService.info(
        `[OAuthDetection][Step3] Flow was NOT completed — skipping notification`,
      );
    }
  };

  /**
   * Step 4: Delegates to the owning provider to check if a navigation
   * represents OAuth flow completion.
   */
  private handleNavBeforeNavigate = (
    details: chrome.webNavigation.WebNavigationTransitionCallbackDetails,
  ): void => {
    if (details.tabId < 0 || details.frameId !== 0) {
      return;
    }

    const flow = this.activeFlows.get(details.tabId);
    if (!flow) {
      return;
    }

    // Find the provider that owns this flow
    const provider = this.providers.find((p) => p.name === flow.ssoProvider);
    if (!provider) {
      return;
    }

    this.logService.info(
      `[OAuthDetection][Step4] [${provider.name}] SSO tab ${details.tabId} navigating to: ${details.url} ` +
        `(email="${flow.email ?? "NOT YET"}", redirectUri="${flow.redirectUri ?? "unknown"}")`,
    );

    const action = provider.detectCompletion(details.url, flow);

    switch (action) {
      case CompletionAction.CompleteAndNotify:
        flow.completed = true;
        this.logService.info(
          `[OAuthDetection][Step4] [${provider.name}] OAuth SUCCESS — ` +
            `tab ${details.tabId}, triggering notification immediately`,
        );
        this.activeFlows.delete(details.tabId);
        this.logService.info(
          `[OAuthDetection] Active flows after removal: ${this.activeFlows.size}`,
        );
        this.triggerSaveNotification(flow);
        break;

      case CompletionAction.CompleteAndWaitForTabClose:
        flow.completed = true;
        this.logService.info(
          `[OAuthDetection][Step4] [${provider.name}] OAuth flow APPROVED — ` +
            `tab ${details.tabId}, waiting for tab close to notify`,
        );
        break;

      case CompletionAction.None:
      default:
        this.logService.info(
          `[OAuthDetection][Step4] [${provider.name}] Not a completion event — continuing to track`,
        );
        break;
    }
  };

  /**
   * Shows the Bitwarden "save login" notification on the origin tab.
   */
  private triggerSaveNotification(flow: OAuthFlowState): void {
    this.logService.info(`[OAuthDetection][Notify] ========================================`);
    this.logService.info(`[OAuthDetection][Notify] TRIGGERING save notification:`);
    this.logService.info(`[OAuthDetection][Notify]   Provider: ${flow.ssoProvider}`);
    this.logService.info(`[OAuthDetection][Notify]   Email:    ${flow.email}`);
    this.logService.info(`[OAuthDetection][Notify]   Origin:   ${flow.originUrl}`);
    this.logService.info(
      `[OAuthDetection][Notify]   Tab:      ${flow.originTab.id} ("${flow.originTab.title}")`,
    );
    this.logService.info(`[OAuthDetection][Notify] ========================================`);

    this.notificationBackground
      .pushSsoLoginToQueue(flow.originTab, flow.ssoProvider, flow.email, flow.originUrl)
      .then(() => {
        this.logService.info(`[OAuthDetection][Notify] pushSsoLoginToQueue SUCCEEDED`);
      })
      .catch((e) => {
        this.logService.error(`[OAuthDetection][Notify] pushSsoLoginToQueue FAILED: ${e}`);
      });
  }
}
