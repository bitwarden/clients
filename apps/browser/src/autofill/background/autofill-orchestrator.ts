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
import { getOptionalUserId } from "@bitwarden/common/auth/services/account.service";
import { AutofillSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/autofill-settings.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { withLatestReady } from "@bitwarden/common/tools/rx";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherRepromptType } from "@bitwarden/common/vault/enums/cipher-reprompt-type";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { BrowserApi } from "../../platform/browser/browser-api";
import {
  AutofillLifecycleService,
  AutomationWorkflow,
} from "../services/abstractions/autofill-lifecycle.service";
import {
  AutofillService,
  AutoFillOptions,
  AutoFillResult,
  DID_NOT_AUTOFILL,
  PageDetail,
} from "../services/abstractions/autofill.service";
import { AutofillTriageResponse } from "../types/autofill-triage";

import { AutofillOrchestrator } from "./abstractions/autofill-orchestrator";

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

/**
 * How recently a cipher must have been launched for a page-load fill to prefer it over the
 * last-used cipher for the URL.
 */
export const LOGIN_LAST_LAUNCHED_WINDOW_MS = 30000;

/**
 * A concrete fill boiled down from a request: the chosen cipher, the rotation key its fillable
 * cipher cycles under (the tab URL for logins, the cipher-type cache key for card/identity), and
 * the {@link AutoFillOptions} flags the service fill needs.
 */
interface PlannedFill {
  cipher: CipherView;
  cycleKey: string;
  options: Partial<AutoFillOptions>;
}

/**
 * The {@link AutoFillOptions} flags a caller-supplied fill applies unless the
 * caller overrides them.
 */
const CALLER_FILL_DEFAULTS = Object.freeze({
  fillNewPassword: true,
  allowTotpAutofill: true,
});

/**
 * Opt-out key for {@link DefaultAutofillOrchestrator.commit}'s foreground verification. It is a symbol
 * private to this module, so no code outside this file can build the options object that turns the
 * check off. This prohibits logic outside the orchestrator from circumventing the type system to
 * invoke a commit without active tab support. The most an external caller can do
 * is omit the key, which fails safe by requiring the active tab.
 */
const requireActiveTab = Symbol("requireActiveTab");

/** {@link DefaultAutofillOrchestrator.commit} overrides, keyed by the module-private {@link requireActiveTab}.
 *
 * DANGER: {@link requireActiveTab} exists only to support extension-initiated fills. NEVER disable this
 * flag from a code path initiated outside of the extension.
 */
type CommitOverrides = { [requireActiveTab]?: boolean };

/**
 * Default implementation of {@link AutofillOrchestrator}. See `orchestrator.design.md` for the
 * sequencing and invariants it upholds.
 */
export class DefaultAutofillOrchestrator implements AutofillOrchestrator {
  /** Serialized-core input; public methods and the page-load subscription feed it. */
  private readonly fillRequest$ = new Subject<FillRequest>();

  constructor(
    private lifecycleService: AutofillLifecycleService,
    private autofillService: AutofillService,
    private cipherService: CipherService,
    private autofillSettingsService: AutofillSettingsServiceAbstraction,
    private accountService: AccountService,
    private platformUtilsService: PlatformUtilsService,
    private updateOverlayCiphers: () => Promise<void>,
    private logService: LogService,
    /** Injected wall-clock source (epoch ms), overridable so time-dependent selection is testable. */
    private now: () => number = () => Date.now(),
  ) {}

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

  autofillActiveTabFromCommand(tab: chrome.tabs.Tab) {
    this.enqueueUserInitiated("command", tab);
  }

  autofillActiveTabForCipherType(tab: chrome.tabs.Tab, cipherType: CipherType) {
    this.enqueueUserInitiated("cipherType", tab, cipherType);
  }

  collectPageDetails(tab: chrome.tabs.Tab, frameId?: number): Promise<PageDetail[]> {
    return firstValueFrom(
      this.autofillService
        .collectPageDetailsFromTab$(tab, frameId)
        .pipe(debounceTime(COLLECT_SETTLE_MS), take(1)),
    );
  }

  collectAutofillTriage(
    tabId: number,
    frameId?: number,
  ): Promise<AutofillTriageResponse | undefined> {
    return new Promise<AutofillTriageResponse | undefined>((resolve) => {
      BrowserApi.sendTabsMessage<AutofillTriageResponse>(
        tabId,
        { command: "collectAutofillTriage" },
        frameId !== undefined ? { frameId } : undefined,
        (response) => {
          // A tab with no autofill receiver rejects via lastError; treat it as "no analysis".
          if (chrome.runtime.lastError) {
            resolve(undefined);
            return;
          }
          resolve(response ?? undefined);
        },
      );
    });
  }

  async fillCipher(options: AutoFillOptions): Promise<AutoFillResult> {
    return this.commit(options);
  }

  async autofillTabWithCipher(
    tab: chrome.tabs.Tab,
    cipher: CipherView,
    options?: Partial<AutoFillOptions>,
  ): Promise<AutoFillResult> {
    const pageDetails = await this.collectPageDetails(tab);
    if (pageDetails.length === 0) {
      return DID_NOT_AUTOFILL;
    }
    const fill = { tab, cipher, pageDetails, ...CALLER_FILL_DEFAULTS, ...options };
    return this.fillCipher(fill);
  }

  async unsafeAutofillTabWithCipher(
    tab: chrome.tabs.Tab,
    cipher: CipherView,
    options?: Partial<AutoFillOptions>,
  ): Promise<AutoFillResult> {
    const pageDetails = await this.collectPageDetails(tab);
    if (pageDetails.length === 0) {
      return DID_NOT_AUTOFILL;
    }

    // FIXME (PM-39579): gate these on the target tab's lifecycle state once that gate lands. Only "warm"
    // tabs should allow unsafe fills.
    const fill = { tab, cipher, pageDetails, ...CALLER_FILL_DEFAULTS, ...options };
    return this.commit(fill, { [requireActiveTab]: false });
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
  private async autoSubmitLoginOnTab(tab: chrome.tabs.Tab, frameId?: number): Promise<void> {
    const activeUserId = await this.activeUserId();
    if (activeUserId == null || !tab.url) {
      return;
    }
    const pageDetails = await this.read(tab, frameId);
    if (pageDetails.length === 0) {
      return;
    }

    const cipher = await this.selectLogin(tab.url, activeUserId, true);
    if (cipher == null || (await this.resolveReprompt(cipher, tab, true, tab.url))) {
      return;
    }

    const result = await this.commit({
      tab,
      cipher,
      pageDetails,
      fillNewPassword: true,
      allowUntrustedIframe: true,
      allowTotpAutofill: true,
      autoSubmitLogin: true,
    });
    if (result.didAutofill) {
      this.cycleFillableCipher(tab.url);
    }
  }

  private enqueueUserInitiated(
    kind: "command" | "cipherType",
    tab: chrome.tabs.Tab,
    cipherType?: CipherType,
  ) {
    const tabId = tab?.id;
    if (tabId == null) {
      // A fill with no tab id cannot be targeted or keyed for serialization.
      return;
    }
    // A user-initiated fill is tab-scoped: it fills the active tab across all frames in one pass,
    // so it carries no frame id and serializes per tab (see `orchestrator.design.md`, "Fills do not
    // race"). It deliberately does not share a per-frame lane with page-load fills.
    this.fillRequest$.next(
      kind === "command"
        ? { kind, tab, tabId, frameId: undefined }
        : { kind: "cipherType", tab, tabId, frameId: undefined, cipherType: cipherType! },
    );
  }

  /**
   * Runs one request to completion as read → select → commit. Errors are logged, never rethrown,
   * so a single failed fill cannot terminate the serialized stream.
   *
   * The three request kinds share this skeleton and differ only in the read scope, the cipher
   * selection, and the post-commit effects — the consolidation this owner exists to provide.
   */
  private async dispatch(request: FillRequest): Promise<void> {
    try {
      const target =
        request.kind === "pageLoad" ? await this.resolveFreshTarget(request) : request.tab;
      if (target == null) {
        return;
      }
      const pageDetails = await this.read(target, request.frameId);
      if (!this.hasFillableDetails(request, pageDetails)) {
        return;
      }

      const plan = await this.selectFill(request, target);
      if (plan == null) {
        return;
      }
      const fromCommand = request.kind !== "pageLoad";
      if (await this.resolveReprompt(plan.cipher, target, fromCommand, plan.cycleKey)) {
        return;
      }

      const result = await this.commit({
        tab: target,
        cipher: plan.cipher,
        pageDetails,
        ...plan.options,
      });

      // A commanded fill cycles the rotation so its next invocation offers the next cipher;
      // a page-load fill uses last-used/last-launched selection and leaves the rotation alone.
      if (fromCommand && result.didAutofill) {
        this.cycleFillableCipher(plan.cycleKey);
      }

      // Login fills copy the TOTP and refresh the overlay ciphers when a fill occurred.
      if (result.didAutofill && (request.kind === "pageLoad" || request.kind === "command")) {
        this.copyTotp(result.totp);
        await this.updateOverlayCiphers();
      }
    } catch (error) {
      this.logService.error(error);
    }
  }

  /**
   * The read operation: collects a target's page details for a fill.
   *
   * A tab-wide collect (no `frameId`) waits `COLLECT_SETTLE_MS` for the tab's frames to answer
   * independently and accumulate into one settled result. A frame-scoped collect gets exactly one
   * response, already complete, so it needs no settle.
   */
  private read(tab: chrome.tabs.Tab, frameId?: number): Promise<PageDetail[]> {
    const details$ = this.autofillService.collectPageDetailsFromTab$(tab, frameId);
    return firstValueFrom(
      frameId == null ? details$.pipe(debounceTime(COLLECT_SETTLE_MS), take(1)) : details$,
    );
  }

  /**
   * Whether a read produced details worth filling. A page-load fill additionally requires the
   * reported frame to still show the URL its cipher was chosen for: the cipher is chosen against
   * the URL captured during the collect, so a same-document navigation between reads must not fill
   * a cipher meant for the old page.
   */
  private hasFillableDetails(request: FillRequest, pageDetails: PageDetail[]): boolean {
    // FIXME (PM-39579): for a tab-wide collect (command / card / identity) this inspects only the
    // first frame to answer — the collect accumulates responses in message-arrival order, not sorted
    // by frame. A fillable form in a sub-frame can be missed when an empty frame replies first.
    const details = pageDetails[0]?.details;
    if (request.kind === "pageLoad") {
      return details?.url === request.frameUrl && !!details?.fields?.length;
    }
    return !!details?.fields?.length;
  }

  /**
   * The select operation: boils a request down to a concrete {@link PlannedFill}, or `undefined`
   * when no cipher applies. Login selection (page load, command, and the defensive cipher-type=login
   * case) reads by URL; card/identity selection reads the next cipher of that type.
   */
  private async selectFill(
    request: FillRequest,
    target: chrome.tabs.Tab,
  ): Promise<PlannedFill | undefined> {
    const activeUserId = await this.activeUserId();
    if (activeUserId == null || !target.url) {
      return undefined;
    }
    const fromCommand = request.kind !== "pageLoad";

    if (request.kind === "cipherType" && request.cipherType !== CipherType.Login) {
      const selection = await this.selectCipherTypeCipher(activeUserId, request.cipherType);
      if (selection == null) {
        return undefined;
      }
      return {
        cipher: selection.cipher,
        cycleKey: selection.cacheKey,
        options: {
          skipLastUsed: false,
          skipUsernameOnlyFill: false,
          onlyEmptyFields: false,
          fillNewPassword: false,
          allowUntrustedIframe: true,
          allowTotpAutofill: false,
        },
      };
    }

    const cipher = await this.selectLogin(target.url, activeUserId, fromCommand);
    if (cipher == null) {
      return undefined;
    }
    return {
      cipher,
      cycleKey: target.url,
      options: {
        skipLastUsed: !fromCommand,
        skipUsernameOnlyFill: !fromCommand,
        onlyEmptyFields: !fromCommand,
        fillNewPassword: fromCommand,
        allowUntrustedIframe: fromCommand,
        allowTotpAutofill: fromCommand,
      },
    };
  }

  /**
   * Selects the login cipher for a URL. A command-initiated fill takes the next cipher in the
   * URL's rotation; a page-load fill prefers a cipher launched within the last
   * {@link LOGIN_LAST_LAUNCHED_WINDOW_MS}, else the last one used for the URL.
   */
  private async selectLogin(
    tabUrl: string,
    activeUserId: UserId,
    fromCommand: boolean,
  ): Promise<CipherView | undefined> {
    if (fromCommand) {
      return (await this.cipherService.getNextCipherForUrl(tabUrl, activeUserId)) ?? undefined;
    }
    const lastLaunchedCipher = await this.cipherService.getLastLaunchedForUrl(
      tabUrl,
      activeUserId,
      true,
    );
    const lastLaunched = lastLaunchedCipher?.localData?.lastLaunched;
    if (
      lastLaunchedCipher &&
      lastLaunched &&
      this.now() - lastLaunched.valueOf() < LOGIN_LAST_LAUNCHED_WINDOW_MS
    ) {
      return lastLaunchedCipher;
    }
    return (await this.cipherService.getLastUsedForUrl(tabUrl, activeUserId, true)) ?? undefined;
  }

  /** Selects the next card or identity cipher and the cache key its rotation index advances under. */
  private async selectCipherTypeCipher(
    activeUserId: UserId,
    cipherType: CipherType,
  ): Promise<{ cipher: CipherView; cacheKey: string } | undefined> {
    const cacheKey = cipherType === CipherType.Card ? "cardCiphers" : "identityCiphers";
    const cipher =
      cipherType === CipherType.Card
        ? await this.cipherService.getNextCardCipher(activeUserId)
        : await this.cipherService.getNextIdentityCipher(activeUserId);
    return cipher ? { cipher, cacheKey } : undefined;
  }

  /**
   * Resolves password reprompt for a selected cipher. Returns `true` to abandon the fill: a
   * page-load fill never surfaces a reprompt popout (a reprompt-protected cipher is simply not
   * filled); a command-strength fill surfaces the master-password popout and abandons this fill,
   * cycling past the reprompt-protected cipher so the next command offers the next one.
   */
  private async resolveReprompt(
    cipher: CipherView,
    target: chrome.tabs.Tab,
    fromCommand: boolean,
    cycleKey: string,
  ): Promise<boolean> {
    if (cipher.reprompt === CipherRepromptType.Password && !fromCommand) {
      return true;
    }
    if (await this.autofillService.isPasswordRepromptRequired(cipher, target)) {
      if (fromCommand) {
        this.cycleFillableCipher(cycleKey);
      }
      return true;
    }
    return false;
  }

  /**
   * The commit operation: the single point where a concrete fill is sent to the service. It verifies
   * the target is the foreground tab, dispatches the fill, and books account activity only once a
   * credential is actually placed.
   */
  private async commit(
    options: AutoFillOptions,
    overrides: CommitOverrides = {},
  ): Promise<AutoFillResult> {
    // Fail safe: absent or any value other than an explicit `false` keeps the verification on.
    if (overrides[requireActiveTab] !== false) {
      const activeTab = await BrowserApi.getTabFromCurrentWindow();
      if (activeTab?.id !== options.tab.id) {
        return DID_NOT_AUTOFILL;
      }
    }
    const result = await this.autofillService.doAutoFill(options);
    if (result.didAutofill) {
      await this.recordActiveAccountActivity();
    }
    return result;
  }

  /**
   * Advances the rotation cursor for a URL (or card/identity cache key) so the *next* fill for it
   * offers the next matching cipher. `updateLastUsedIndexForUrl` is that cursor — a way to cycle
   * through the ciphers that fit a page across repeated fills — not a record that a cipher was used.
   */
  private cycleFillableCipher(key: string): void {
    this.cipherService.updateLastUsedIndexForUrl(key);
  }

  private activeUserId(): Promise<UserId | undefined> {
    return firstValueFrom(this.accountService.activeAccount$.pipe(getOptionalUserId));
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
    await this.accountService.setAccountActivity(activeUserId, new Date(this.now()));
  }

  private copyTotp(totp: string | undefined) {
    if (totp !== undefined) {
      this.platformUtilsService.copyToClipboard(totp);
    }
  }
}
