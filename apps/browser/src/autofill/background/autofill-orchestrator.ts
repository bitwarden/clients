import {
  concatMap,
  filter,
  firstValueFrom,
  groupBy,
  map,
  mergeMap,
  retry,
  Subject,
  takeUntil,
  withLatestFrom,
} from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AutofillSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/autofill-settings.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { withLatestReady } from "@bitwarden/common/tools/rx";
import { CipherType } from "@bitwarden/common/vault/enums";

import { BrowserApi } from "../../platform/browser/browser-api";
import { AutofillLifecycleService } from "../services/abstractions/autofill-lifecycle.service";
import { AutofillService, PageDetail } from "../services/abstractions/autofill.service";

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
      pageDetail: PageDetail;
    }
  | {
      kind: "cipherType";
      tab: chrome.tabs.Tab;
      tabId: number;
      frameId: number | undefined;
      pageDetail: PageDetail;
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
  }

  /**
   * Fills the active tab from a keyboard-shortcut collection. Preserves the
   * shared `AutofillCommand` side effects: account activity, TOTP clipboard copy,
   * and overlay-cipher refresh.
   */
  autofillActiveTabFromCommand(pageDetail: PageDetail) {
    this.enqueueUserInitiated("command", pageDetail);
  }

  /**
   * Fills the active tab with the next card or identity cipher. Card/identity
   * fills carry none of the page-load/keyboard side effects.
   */
  autofillActiveTabForCipherType(pageDetail: PageDetail, cipherType: CipherType) {
    this.enqueueUserInitiated("cipherType", pageDetail, cipherType);
  }

  private enqueueUserInitiated(
    kind: "command" | "cipherType",
    pageDetail: PageDetail,
    cipherType?: CipherType,
  ) {
    const { tab, frameId } = pageDetail;
    const tabId = tab?.id;
    if (tabId == null) {
      // A fill with no tab id cannot be targeted or keyed for serialization;
      // `doAutoFill`'s tab-match guard would drop it anyway.
      return;
    }
    this.fillRequest$.next(
      kind === "command"
        ? { kind, tab, tabId, frameId, pageDetail }
        : { kind: "cipherType", tab, tabId, frameId, pageDetail, cipherType: cipherType! },
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
          await this.recordActiveAccountActivity();
          const totp = await this.autofillService.doAutoFillActiveTab([request.pageDetail], true);
          this.copyTotp(totp);
          await this.updateOverlayCiphers();
          break;
        }
        case "cipherType": {
          await this.autofillService.doAutoFillActiveTab(
            [request.pageDetail],
            true,
            request.cipherType,
          );
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
