import {
  concatMap,
  debounceTime,
  filter,
  firstValueFrom,
  groupBy,
  map,
  mergeMap,
  retry,
  Subject,
  take,
  takeUntil,
  withLatestFrom,
} from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AutofillSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/autofill-settings.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { withLatestReady } from "@bitwarden/common/tools/rx";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { BrowserApi } from "../../platform/browser/browser-api";
import {
  AutofillLifecycleService,
  AutomationWorkflow,
} from "../services/abstractions/autofill-lifecycle.service";
import {
  AutofillService,
  AutoFillOptions,
  PageDetail,
} from "../services/abstractions/autofill.service";
import { AutofillTriageResponse } from "../types/autofill-triage";

/**
 * A fill the background drives from a runtime message or a resolved page
 * transition.
 */
type FillRequest =
  | {
      kind: "pageLoad";
      tab: chrome.tabs.Tab;
      tabId: number;
      frameId: number | undefined;
      // The reporting frame's URL, from the message sender. Validated against the frame's live URL
      // at dispatch so a navigated frame is not filled with a cipher chosen for the old page.
      frameUrl: string;
    }
  | {
      kind: "command";
      tab: chrome.tabs.Tab;
      tabId: number;
      frameId: number | undefined;
    }
  | {
      kind: "cipherType";
      tab: chrome.tabs.Tab;
      tabId: number;
      frameId: number | undefined;
      cipherType: CipherType;
    };

/**
 * How many times the dispatch pipe re-seeds the live-tab set after a seed failure
 * before giving up. Bounded so a persistently failing seed cannot loop forever.
 */
export const LIVE_TAB_SEED_MAX_RETRIES = 4;

/** Delay between live-tab seed retries, giving a transient failure time to clear. */
export const LIVE_TAB_SEED_RETRY_DELAY_MS = 250;

/**
 * Quiescence window a multi-frame collection waits for before it is used. A tab's
 * frames answer a collect independently; this lets their responses accumulate into
 * one settled result instead of dispatching a fill per frame as each replies.
 */
export const COLLECT_SETTLE_MS = 50;

/** Outcome of a fill dispatched by {@link AutofillOrchestrator.autofillTabWithCipher}. */
export interface TabFillResult {
  /** Whether a fill actually ran; `false` when the tab produced no page details to fill. */
  filled: boolean;
  /** A TOTP for the caller to copy to the clipboard, or `null`. */
  totp: string | null;
}

/**
 * The single owner of runtime-message-driven autofill dispatch.
 *
 * See `autofill.design.md` for more information. Per-tab
 * groups end when the tab is removed, so the grouping does not leak.
 */
export class AutofillOrchestrator {
  /** Serialized-core input; public methods and the page-load subscription feed it. */
  private readonly fillRequest$ = new Subject<FillRequest>();

  constructor(
    private lifecycleService: AutofillLifecycleService,
    private autofillService: AutofillService,
    private autofillSettingsService: AutofillSettingsServiceAbstraction,
    private accountService: AccountService,
    private platformUtilsService: PlatformUtilsService,
    private updateOverlayCiphers: () => Promise<void>,
    private logService: LogService,
  ) {}

  /**
   * Wires the serialized dispatch core and the page-load consumer. Call once,
   * when the background starts, after the lifecycle service is initialized.
   * Subscriptions are process-lifetime — this is a background singleton.
   */
  init() {
    // sequence and dispatch fill requests through a common pipe to prevent dispatch
    // calls from interleaving async collections and fills.
    this.fillRequest$
      .pipe(
        // Drop any request whose tab id is not a currently-open tab before it can
        // open a per-tab group.
        withLatestReady(this.lifecycleService.liveTabs$),
        filter(([request, liveTabs]) => liveTabs.has(request.tabId)),
        map(([request]) => request),
        groupBy((request) => request.tabId),
        mergeMap((tabGroup) =>
          tabGroup.pipe(
            groupBy((request) => request.frameId ?? -1),
            mergeMap((frameGroup) =>
              frameGroup.pipe(concatMap((request) => this.dispatch(request))),
            ),
            takeUntil(this.lifecycleService.tabRemoved$(tabGroup.key)),
          ),
        ),
        // circuit-break fill requests when tab validation repeatedly fails
        retry({ count: LIVE_TAB_SEED_MAX_RETRIES, delay: LIVE_TAB_SEED_RETRY_DELAY_MS }),
      )
      .subscribe({
        error: (error: unknown) =>
          this.logService.error(
            "Autofill dispatch stopped: live-tab set could not be established.",
            error,
          ),
      });

    // Page-load opportunities feed the same serialized stream, gated reactively on
    // the current autofill-on-page-load setting.
    this.lifecycleService.pageTransitionResolved$
      .pipe(
        withLatestFrom(this.autofillSettingsService.autofillOnPageLoad$),
        filter(([, autofillOnPageLoad]) => autofillOnPageLoad),
        map(([opportunity]) => opportunity),
      )
      .subscribe(({ tab, tabId, frameId, frameUrl }) =>
        this.fillRequest$.next({ kind: "pageLoad", tab, tabId, frameId, frameUrl }),
      );

    // The auto-submit-login workflow reports each step as a fact; interpret it as one
    // collect → fill → submit.
    this.lifecycleService.automatedLoginStepReady$
      .pipe(filter((signal) => signal.workflow === AutomationWorkflow.autoSubmitLogin))
      .subscribe((signal) => {
        void this.autoSubmitLoginOnTab(signal.tab, signal.frameId).catch((error: unknown) =>
          this.logService.error(error),
        );
      });
  }

  /**
   * Fills the active tab from a keyboard shortcut. The orchestrator collects the
   * tab's page details itself inside the serialized dispatch, so collection is
   * sequenced with the fill. Preserves the shared `AutofillCommand` side effects:
   * account activity, TOTP clipboard copy, and overlay-cipher refresh.
   */
  autofillActiveTabFromCommand(tab: chrome.tabs.Tab) {
    this.enqueueUserInitiated("command", tab);
  }

  /**
   * Fills the active tab with the next card or identity cipher, collecting the
   * tab's page details inside the serialized dispatch. Card/identity fills carry
   * none of the page-load/keyboard side effects.
   */
  autofillActiveTabForCipherType(tab: chrome.tabs.Tab, cipherType: CipherType) {
    this.enqueueUserInitiated("cipherType", tab, cipherType);
  }

  /**
   * Collects a tab's page details. This is a one-shot collect, not part of the
   * serialized fill pipe.
   *
   * Because a tab's frames answer independently, this waits `COLLECT_SETTLE_MS` for
   * their responses to accumulate. A frame-scoped collect needs no such settle —
   * its first and only response is already complete.
   *
   * Resolves once the collection settles, or with an empty array when the tab does
   * not respond.
   *
   * @param tab The tab to collect from
   * @param frameId When set, collect only this frame; otherwise every frame
   */
  collectPageDetails(tab: chrome.tabs.Tab, frameId?: number): Promise<PageDetail[]> {
    return firstValueFrom(
      this.autofillService
        .collectPageDetailsFromTab$(tab, frameId)
        .pipe(debounceTime(COLLECT_SETTLE_MS), take(1)),
    );
  }

  /**
   * Collects autofill-triage analysis for a tab from the same single owner. Unlike
   * {@link collectPageDetails} this is a direct one-shot request/response (its own
   * message round-trip), not part of the serialized fill pipe. Resolves with `null`
   * when the tab has no receiver or does not respond.
   *
   * @param tabId The tab to analyze
   * @param frameId When set, analyze only this frame
   */
  collectAutofillTriage(tabId: number, frameId?: number): Promise<AutofillTriageResponse | null> {
    return new Promise<AutofillTriageResponse | null>((resolve) => {
      BrowserApi.sendTabsMessage<AutofillTriageResponse>(
        tabId,
        { command: "collectAutofillTriage" },
        frameId !== undefined ? { frameId } : undefined,
        (response) => {
          // A tab with no autofill receiver rejects via lastError; treat it as "no analysis".
          if (chrome.runtime.lastError) {
            resolve(null);
            return;
          }
          resolve(response ?? null);
        },
      );
    });
  }

  /**
   * Fills a caller-supplied cipher into a tab. This is the orchestrator's entry for
   * externally-initiated fills (inline menu, generated password, etc) that bring
   * their own cipher.
   *
   * Returns the TOTP to copy, or `null`.
   */
  fillCipher(options: AutoFillOptions): Promise<string | null> {
    // FIXME (PM-39579): once the tab-lifecycle gate lands, route these through the gated dispatch (or
    // assert the active tab) so the fill is gated on the target tab's state here.
    return this.autofillService.doAutoFill(options);
  }

  /**
   * Collects a tab's page details and fills the given cipher into it — the shared "fill a chosen
   * cipher into this tab" sequence used by the context menu and the popup round-trip, so the
   * collect→fill glue lives here rather than in each caller. Carries the same FIXME (PM-39579)
   * gating caveat as {@link fillCipher}. Reports whether a fill ran and the TOTP to copy.
   */
  async autofillTabWithCipher(
    tab: chrome.tabs.Tab,
    cipher: CipherView,
    options?: Partial<AutoFillOptions>,
  ): Promise<TabFillResult> {
    const pageDetails = await this.collectPageDetails(tab);
    if (pageDetails.length === 0) {
      return { filled: false, totp: null };
    }
    const totp = await this.fillCipher({
      tab,
      cipher,
      pageDetails,
      fillNewPassword: true,
      allowTotpAutofill: true,
      ...options,
    });
    return { filled: true, totp: totp ?? null };
  }

  /**
   * Runs the orchestrator's *submit* phase using a `collect → fill → submit` workflow.
   *
   * A step is one `collect → fill → submit`. The content script drives the *cadence* across a
   * multi-step form, re-invoking this once each step's DOM has settled.
   *
   * @param tab The tab whose frame is running the auto-submit workflow
   * @param frameId The frame that reported the auto-submit opportunity
   */
  async autoSubmitLoginOnTab(tab: chrome.tabs.Tab, frameId?: number): Promise<void> {
    // FIXME (PM-39579): once the tab-lifecycle gate lands, gate this collect+fill on the target
    // tab's state (or route it through the gated dispatch) so the fill-and-submit is state-gated.
    const pageDetails = await this.collectPageDetails(tab, frameId);
    if (pageDetails.length === 0) {
      return;
    }
    await this.autofillService.doAutoFillOnTab(pageDetails, tab, true, true);
  }

  private enqueueUserInitiated(
    kind: "command" | "cipherType",
    tab: chrome.tabs.Tab,
    cipherType?: CipherType,
  ) {
    const tabId = tab?.id;
    if (tabId == null) {
      // A fill with no tab id cannot be targeted or keyed for serialization;
      // `doAutoFill`'s tab-match guard would drop it anyway.
      return;
    }
    // A user-initiated fill is tab-scoped: it fills the active tab across all frames in one pass,
    // so it carries no frame id and serializes per tab (see `autofill.design.md`). It deliberately
    // does not share a per-frame lane with page-load fills; each path guards origin independently.
    this.fillRequest$.next(
      kind === "command"
        ? { kind, tab, tabId, frameId: undefined }
        : { kind: "cipherType", tab, tabId, frameId: undefined, cipherType: cipherType! },
    );
  }

  /**
   * Runs one fill to completion. Errors are logged, never rethrown, so a single
   * failed fill cannot terminate the serialized stream.
   */
  private async dispatch(request: FillRequest): Promise<void> {
    try {
      switch (request.kind) {
        case "pageLoad": {
          // Re-resolve the target tab live and confirm the reported frame has not navigated;
          // abandon otherwise (see autofill.design.md, "Fill targeting").
          const liveTab = await this.resolveFreshTarget(request);
          if (liveTab == null) {
            return;
          }

          // FIXME (PM-39579): the tab gate replaces this. Until then, keep filling only the active
          // tab, since resolving the target by id would otherwise fill a background tab.
          const activeTab = await BrowserApi.getTabFromCurrentWindow();
          if (activeTab?.id !== request.tabId) {
            return;
          }

          // Collect and fill inside the serialized step so this frame's collect→fill is atomic.
          // This collect is frame-scoped (the reporting frame), so its first emission is already
          // complete — no settle is needed, unlike the tab-wide `collectPageDetails` below.
          const pageDetails = await firstValueFrom(
            this.autofillService.collectPageDetailsFromTab$(liveTab, request.frameId),
          );
          await this.recordActiveAccountActivity();

          // The cipher is read before data collection, while the content script gates the fill on
          // the URL captured during the collect. Guard against a same-document navigation between
          // those reads from filling a cipher chosen for the old URL to the new page.
          let totp: string | null = null;
          const details = pageDetails[0]?.details;
          if (details?.url === request.frameUrl && details?.fields?.length) {
            totp = await this.autofillService.doAutoFillOnTab(pageDetails, liveTab, false);
          }
          this.copyTotp(totp);
          await this.updateOverlayCiphers();
          break;
        }
        case "command": {
          // Collect inside the serialized step so this tab's collect→fill is atomic.
          const pageDetails = await this.collectPageDetails(request.tab);
          if (pageDetails.length === 0) {
            return;
          }
          await this.recordActiveAccountActivity();
          const totp = await this.autofillService.doAutoFillActiveTab(pageDetails, true);
          this.copyTotp(totp);
          await this.updateOverlayCiphers();
          break;
        }
        case "cipherType": {
          const pageDetails = await this.collectPageDetails(request.tab);
          if (pageDetails.length === 0) {
            return;
          }
          await this.autofillService.doAutoFillActiveTab(pageDetails, true, request.cipherType);
          break;
        }
      }
    } catch (error) {
      this.logService.error(error);
    }
  }

  /**
   * Re-resolves the reported frame's tab live by id and confirms the frame still shows the URL it
   * reported. Returns the live tab when the fill may proceed, or undefined to abandon.
   */
  private async resolveFreshTarget(
    request: Extract<FillRequest, { kind: "pageLoad" }>,
  ): Promise<chrome.tabs.Tab | undefined> {
    // `getTab` may return null synchronously (no tab id) or a promise that rejects (tab gone);
    // both collapse to a clean abandon rather than a logged error.
    const liveTab = await BrowserApi.getTab(request.tabId)?.catch((): undefined => undefined);
    if (liveTab == null) {
      return undefined;
    }

    // A sub-frame's URL is not the tab's, so its own live URL is resolved
    const liveFrameUrl =
      request.frameId == null || request.frameId === 0
        ? liveTab.url
        : await BrowserApi.getFrameDetails({ tabId: request.tabId, frameId: request.frameId })
            .then((frame) => frame?.url)
            .catch((): undefined => undefined);
    return liveFrameUrl === request.frameUrl ? liveTab : undefined;
  }

  private async recordActiveAccountActivity() {
    const activeUserId = await firstValueFrom(
      this.accountService.activeAccount$.pipe(map((account) => account?.id)),
    );
    // Page-load and keyboard fills only reach here while logged in, so an absent
    // active account is defensive; skip the bump rather than record against none.
    if (activeUserId == null) {
      return;
    }
    await this.accountService.setAccountActivity(activeUserId, new Date());
  }

  private copyTotp(totp: string | null) {
    if (totp != null) {
      this.platformUtilsService.copyToClipboard(totp);
    }
  }
}
