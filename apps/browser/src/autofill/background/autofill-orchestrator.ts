import {
  concatMap,
  filter,
  firstValueFrom,
  groupBy,
  map,
  mergeMap,
  Subject,
  takeUntil,
  withLatestFrom,
} from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AutofillSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/autofill-settings.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherType } from "@bitwarden/common/vault/enums";

import { BrowserApi } from "../../platform/browser/browser-api";
import { AutofillLifecycleService } from "../services/abstractions/autofill-lifecycle.service";
import { AutofillService, PageDetail } from "../services/abstractions/autofill.service";

/**
 * A fill the background drives from a runtime message or a resolved page
 * transition. Every flavor carries a `(tabId, frameId)` so the serialized core
 * can key on it. Page-load requests collect their own page details at dispatch;
 * user-initiated requests carry the single `PageDetail` the content script
 * already sent (these paths report exactly one frame's details).
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
 * The single owner of runtime-message-driven autofill dispatch: page-load fills
 * (consumed from the lifecycle's `pageTransitionResolved$` opportunity) and the
 * user-initiated keyboard-shortcut, card, and identity fills the background
 * forwards from `collectPageDetailsResponse`.
 *
 * Every fill routes through one per-`(tab, frame)` serialized entry point, so a
 * page-load opportunity and a user-initiated fill on the same frame cannot
 * interleave. That makes each frame's collect→fill atomic and prevents a
 * concurrent double-fill / wrong-origin race — two fills racing on one frame. See
 * the "Fills are serialized per frame" note in `autofill.design.md`. Per-tab
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
    // Serialized core: group per tab, then per frame; serialize within each frame
    // (concatMap) while different frames/tabs run concurrently (mergeMap). When a
    // tab is removed, `takeUntil` ends that tab's pipeline — abandoning any queued
    // fill (an already-dispatched one still finishes) and tearing down the per-tab
    // subscriptions so the grouping does not leak.
    this.fillRequest$
      .pipe(
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
      )
      .subscribe();

    // Page-load opportunities feed the same serialized stream, gated reactively on
    // the current autofill-on-page-load setting (this fill-time check is what
    // enforces the setting when a user toggles it off mid-session).
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

          // Collect and fill inside the serialized step so this frame's collect→fill is atomic
          // (autofill.design.md, "Fills are serialized per frame"). Scope to the reported frame;
          // an undefined frameId collects the whole tab.
          const pageDetails = await firstValueFrom(
            this.autofillService.collectPageDetailsFromTab$(liveTab, request.frameId),
          );
          await this.recordActiveAccountActivity();
          // doAutoFillOnTab throws on empty details; short-circuit to preserve the null outcome.
          const totp = pageDetails[0]?.details?.fields?.length
            ? await this.autofillService.doAutoFillOnTab(pageDetails, liveTab, false)
            : null;
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
   * reported. Returns the live tab when the fill may proceed, or null to abandon — the tab is gone,
   * the frame is gone, or the frame has navigated. A sub-frame's URL is not the tab's, so its own
   * live URL is resolved; the top frame's is the tab's. Never derives the target from the carried
   * snapshot (see autofill.design.md, "Fill targeting").
   */
  private async resolveFreshTarget(
    request: Extract<FillRequest, { kind: "pageLoad" }>,
  ): Promise<chrome.tabs.Tab | null> {
    const liveTab = await BrowserApi.getTab(request.tabId).catch((): null => null);
    if (liveTab == null) {
      return null;
    }
    const liveFrameUrl =
      request.frameId == null || request.frameId === 0
        ? liveTab.url
        : await BrowserApi.getFrameDetails({ tabId: request.tabId, frameId: request.frameId })
            .then((frame) => frame?.url)
            .catch((): undefined => undefined);
    return liveFrameUrl === request.frameUrl ? liveTab : null;
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
