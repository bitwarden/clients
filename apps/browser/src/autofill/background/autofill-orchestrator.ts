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
  | { kind: "pageLoad"; tab: chrome.tabs.Tab; tabId: number; frameId: number | undefined }
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
 * forwards from `collectPageDetailsResponse`. It heals the split-brain the
 * lifecycle service and `runtime.background.ts` used to share (see
 * `autofill.design.md`): the lifecycle reconciles a transition into an
 * opportunity; this class decides whether and how to fill, and owns the fill's
 * side effects.
 *
 * Every fill routes through one per-`(tab, frame)` serialized entry point, so a
 * page-load opportunity and a user-initiated fill on the same frame cannot
 * interleave. That makes each frame's collect→fill atomic and prevents the
 * concurrent double-fill / wrong-origin race the stateless two-hop could not (it
 * had no per-frame state to serialize on). See the "Fills are serialized per
 * frame" note in `autofill.design.md`. Per-tab groups are ended when the tab is
 * removed, so the grouping does not leak.
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
      .subscribe(({ tab, tabId, frameId }) =>
        this.fillRequest$.next({ kind: "pageLoad", tab, tabId, frameId }),
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
          // Collect then fill inside the serialized step, so this frame's
          // collect→fill is atomic (see autofill.design.md, "Fills are serialized
          // per frame").
          // FIXME (Step 6): this collects across every frame of the tab and
          // ignores request.frameId; scope it to the reported frame when fill
          // targeting is tightened (design doc: "collect the frame's page details").
          const pageDetails = await firstValueFrom(
            this.autofillService.collectPageDetailsFromTab$(request.tab),
          );
          await this.recordActiveAccountActivity();
          const totp = await this.autofillService.doAutoFillActiveTab(pageDetails, false);
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
