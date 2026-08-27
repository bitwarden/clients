import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, defer, filter, map, of, Subject, throwError } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AutofillSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/autofill-settings.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherRepromptType } from "@bitwarden/common/vault/enums/cipher-reprompt-type";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { BrowserApi } from "../../platform/browser/browser-api";
import {
  AutomatedLoginStepReady,
  AutomationWorkflow,
  AutofillLifecycleService,
  PageTransitionResolved,
} from "../services/abstractions/autofill-lifecycle.service";
import {
  AutoFillResult,
  AutofillService,
  PageDetail,
} from "../services/abstractions/autofill.service";
import {
  createAutofillFieldMock,
  createAutofillPageDetailsMock,
  createChromeTabMock,
  createPageDetailMock,
} from "../spec/autofill-mocks";
import { flushPromises } from "../spec/testing-utils";

import {
  DefaultAutofillOrchestrator,
  LIVE_TAB_SEED_MAX_RETRIES,
  LIVE_TAB_SEED_RETRY_DELAY_MS,
} from "./autofill-orchestrator";

describe("DefaultAutofillOrchestrator", () => {
  let autofillOrchestrator: DefaultAutofillOrchestrator;
  let lifecycleService: MockProxy<AutofillLifecycleService>;
  let autofillService: MockProxy<AutofillService>;
  let cipherService: MockProxy<CipherService>;
  let autofillSettingsService: MockProxy<AutofillSettingsServiceAbstraction>;
  let accountService: MockProxy<AccountService>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let updateOverlayCiphers: jest.Mock<Promise<void>, []>;
  const logService = mock<LogService>();

  let pageTransitionResolved$: Subject<PageTransitionResolved>;
  let automatedLoginStepReady$: Subject<AutomatedLoginStepReady>;
  let tabRemovedSubject$: Subject<number>;
  let autofillOnPageLoad$: BehaviorSubject<boolean>;
  let liveTabs$: BehaviorSubject<ReadonlySet<number>>;

  // createChromeTabMock's default url; the live tab and reported frame url share it by default so
  // the fill-time match succeeds unless a test overrides one side.
  const DEFAULT_URL = "https://jest-testing-website.com";

  // Builds a cipher of an explicit type — every callsite names the type it is exercising (login,
  // card, or identity). The type is applied last so an `overrides` object can never contradict it.
  const makeCipher = (type: CipherType, overrides: Partial<CipherView> = {}): CipherView =>
    ({
      id: "c1",
      reprompt: CipherRepromptType.None,
      login: {},
      localData: undefined,
      ...overrides,
      type,
    }) as unknown as CipherView;

  const pageDetail = (tabId: number | undefined, frameId: number): PageDetail => {
    const tab = createChromeTabMock({ id: tabId });
    // A collected frame reports its own url; default it to the tab url so a top-frame page-load
    // passes the fill-time freshness check (details.url === frameUrl). Sub-frame tests, whose
    // frame url differs from the tab's, set a distinct url explicitly.
    return createPageDetailMock({
      frameId,
      tab,
      details: createAutofillPageDetailsMock({ url: tab.url }),
    });
  };

  const emitPageTransition = (pd: PageDetail, frameUrl: string = pd.tab.url ?? DEFAULT_URL) =>
    pageTransitionResolved$.next({ tab: pd.tab, tabId: pd.tab.id!, frameId: pd.frameId, frameUrl });

  const removeTab = (tabId: number) => tabRemovedSubject$.next(tabId);

  const emitAutomatedLoginStep = (
    pd: PageDetail,
    workflow: AutomationWorkflow = AutomationWorkflow.autoSubmitLogin,
  ) =>
    automatedLoginStepReady$.next({
      tab: pd.tab,
      tabId: pd.tab.id!,
      frameId: pd.frameId,
      frameUrl: pd.tab.url ?? DEFAULT_URL,
      workflow,
    });

  // A promise whose resolution the test controls, so it can hold a fill in flight.
  const deferred = () => {
    let resolve!: (value: AutoFillResult) => void;
    const promise = new Promise<AutoFillResult>((r) => (resolve = r));
    return { promise, resolve };
  };

  // A request dropped before the read runs nothing at all: no collect, no fill, no activity, no
  // overlay refresh. Asserting the collect never ran distinguishes a pre-read drop from a downstream
  // short-circuit that skips only the fill. Covers every pre-read abandon — a rejected
  // `resolveFreshTarget`, a live-tab-gate drop, a missing tab id, or autofill-on-page-load being off.
  const expectAbandoned = () => {
    expect(autofillService.collectPageDetailsFromTab$).not.toHaveBeenCalled();
    expect(autofillService.doAutoFill).not.toHaveBeenCalled();
    expect(accountService.setAccountActivity).not.toHaveBeenCalled();
    expect(updateOverlayCiphers).not.toHaveBeenCalled();
  };

  // A fixed clock (epoch ms) so last-launched-window selection is deterministic; overridable.
  const NOW = 1_700_000_000_000;

  const construct = (now: () => number = () => NOW) =>
    new DefaultAutofillOrchestrator(
      lifecycleService,
      autofillService,
      cipherService,
      autofillSettingsService,
      accountService,
      platformUtilsService,
      updateOverlayCiphers,
      logService,
      now,
    );

  beforeEach(() => {
    pageTransitionResolved$ = new Subject<PageTransitionResolved>();
    automatedLoginStepReady$ = new Subject<AutomatedLoginStepReady>();
    tabRemovedSubject$ = new Subject<number>();
    autofillOnPageLoad$ = new BehaviorSubject<boolean>(true);
    // The tabs used across these tests are open by default so requests pass the live-tab gate;
    // the gate tests below override this to exercise the drop path (empty set) and the seed-error
    // fail-open path.
    liveTabs$ = new BehaviorSubject<ReadonlySet<number>>(new Set([1, 2]));

    lifecycleService = mock<AutofillLifecycleService>();
    (lifecycleService as any).pageTransitionResolved$ = pageTransitionResolved$;
    (lifecycleService as any).automatedLoginStepReady$ = automatedLoginStepReady$;
    (lifecycleService as any).liveTabs$ = liveTabs$;
    lifecycleService.tabRemoved$.mockImplementation((tabId: number) =>
      tabRemovedSubject$.pipe(
        filter((removedTabId) => removedTabId === tabId),
        map((): void => undefined),
      ),
    );

    autofillService = mock<AutofillService>();
    autofillService.collectPageDetailsFromTab$.mockReturnValue(of([]));
    autofillService.doAutoFill.mockResolvedValue({ didAutofill: false });
    autofillService.isPasswordRepromptRequired.mockResolvedValue(false);
    cipherService = mock<CipherService>();
    cipherService.getLastLaunchedForUrl.mockResolvedValue(undefined as unknown as CipherView);
    cipherService.getLastUsedForUrl.mockResolvedValue(makeCipher(CipherType.Login));
    cipherService.getNextCipherForUrl.mockResolvedValue(makeCipher(CipherType.Login));
    cipherService.getNextCardCipher.mockResolvedValue(makeCipher(CipherType.Card));
    cipherService.getNextIdentityCipher.mockResolvedValue(makeCipher(CipherType.Identity));

    // Page-load fills re-resolve the target tab by id and require its URL to still match the
    // transition. By default the live tab matches (same id, same default url) and is the active
    // tab, so page-load fills proceed; individual tests override to exercise the abandon paths.
    jest
      .spyOn(BrowserApi, "getTab")
      .mockImplementation(async (id: number) => createChromeTabMock({ id }));
    jest
      .spyOn(BrowserApi, "getTabFromCurrentWindow")
      .mockResolvedValue(createChromeTabMock({ id: 1 }));
    // Sub-frame fills validate against the frame's live url; default it to the shared url so a
    // sub-frame transition matches unless a test says otherwise.
    jest
      .spyOn(BrowserApi, "getFrameDetails")
      .mockResolvedValue(mock<chrome.webNavigation.GetFrameResultDetails>({ url: DEFAULT_URL }));

    autofillSettingsService = mock<AutofillSettingsServiceAbstraction>();
    autofillSettingsService.autofillOnPageLoad$ = autofillOnPageLoad$;

    accountService = mock<AccountService>();
    (accountService as any).activeAccount$ = new BehaviorSubject({ id: "user-1" });

    platformUtilsService = mock<PlatformUtilsService>();
    updateOverlayCiphers = jest.fn().mockResolvedValue(undefined);

    autofillOrchestrator = construct();
    autofillOrchestrator.init();
  });

  // `logService` is a module-level mock reused across tests; clear it (and the
  // per-test spies) so counts and call history don't bleed between cases.
  afterEach(() => jest.clearAllMocks());

  describe("page-load fills", () => {
    it("properly sequences target resolution, validation, data collection, activity reporting, autofill operations, and UI updates", async () => {
      // A fill that places a credential and copies a TOTP exercises every stage, so their relative
      // order can be asserted end to end. What each stage is called *with* is covered separately.
      const url = "https://login.example.com/session";
      const pd = createPageDetailMock({
        frameId: 0,
        tab: createChromeTabMock({ id: 1, url }),
        details: createAutofillPageDetailsMock({ url }),
      });
      autofillService.collectPageDetailsFromTab$.mockReturnValue(of([pd]));
      cipherService.getLastUsedForUrl.mockResolvedValue(makeCipher(CipherType.Login));
      jest.spyOn(BrowserApi, "getTab").mockResolvedValue(createChromeTabMock({ id: 1, url }));
      jest
        .spyOn(BrowserApi, "getTabFromCurrentWindow")
        .mockResolvedValue(createChromeTabMock({ id: 1, url }));
      autofillService.doAutoFill.mockResolvedValue({ didAutofill: true, totp: "999999" });

      emitPageTransition(pd);
      await flushPromises();

      // Target resolution → data collection → autofill → activity → TOTP copy → overlay refresh.
      expect((BrowserApi.getTab as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
        autofillService.collectPageDetailsFromTab$.mock.invocationCallOrder[0],
      );
      expect(autofillService.collectPageDetailsFromTab$.mock.invocationCallOrder[0]).toBeLessThan(
        autofillService.doAutoFill.mock.invocationCallOrder[0],
      );
      expect(autofillService.doAutoFill.mock.invocationCallOrder[0]).toBeLessThan(
        accountService.setAccountActivity.mock.invocationCallOrder[0],
      );
      expect(accountService.setAccountActivity.mock.invocationCallOrder[0]).toBeLessThan(
        platformUtilsService.copyToClipboard.mock.invocationCallOrder[0],
      );
      expect(platformUtilsService.copyToClipboard.mock.invocationCallOrder[0]).toBeLessThan(
        updateOverlayCiphers.mock.invocationCallOrder[0],
      );
    });

    it("passes the resolved target, selected cipher, and page-load options to each fill stage", async () => {
      // The top frame's live url (the tab's) matches the reported frame url, so the fill proceeds.
      const url = "https://login.example.com/session";
      const pd = createPageDetailMock({
        frameId: 0,
        tab: createChromeTabMock({ id: 1, url }),
        details: createAutofillPageDetailsMock({ url }),
      });
      const cipher = makeCipher(CipherType.Login);
      autofillService.collectPageDetailsFromTab$.mockReturnValue(of([pd]));
      cipherService.getLastUsedForUrl.mockResolvedValue(cipher);
      jest.spyOn(BrowserApi, "getTab").mockResolvedValue(createChromeTabMock({ id: 1, url }));
      // The target tab is the current-window active tab, so commit's live active-tab check sees the
      // same url the fill targets.
      jest
        .spyOn(BrowserApi, "getTabFromCurrentWindow")
        .mockResolvedValue(createChromeTabMock({ id: 1, url }));
      autofillService.doAutoFill.mockResolvedValue({ didAutofill: true, totp: "999999" });

      emitPageTransition(pd);
      await flushPromises();

      expect(BrowserApi.getTab).toHaveBeenCalledWith(1);
      // Collect is scoped to the reported frame and targets the live tab, not the seam snapshot.
      expect(autofillService.collectPageDetailsFromTab$).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1, url }),
        0,
      );
      // Selection is by url; a page-load prefers last-used (no recent last-launched by default).
      expect(cipherService.getLastUsedForUrl).toHaveBeenCalledWith(url, "user-1", true);
      expect(accountService.setAccountActivity).toHaveBeenCalledWith("user-1", expect.any(Date));
      // The fill targets the live tab with the page-load option shape (non-command).
      expect(autofillService.doAutoFill).toHaveBeenCalledWith(
        expect.objectContaining({
          tab: expect.objectContaining({ id: 1, url }),
          cipher,
          pageDetails: [pd],
          skipLastUsed: true,
          fillNewPassword: false,
          allowTotpAutofill: false,
        }),
      );
      expect(platformUtilsService.copyToClipboard).toHaveBeenCalledWith("999999");
      expect(updateOverlayCiphers).toHaveBeenCalledTimes(1);
      // A page-load fill uses last-used/last-launched selection, so it does not cycle the rotation.
      expect(cipherService.updateLastUsedIndexForUrl).not.toHaveBeenCalled();
    });

    it("prefers a cipher launched within the last-launched window over the last-used cipher", async () => {
      const pd = pageDetail(1, 0);
      const launched = makeCipher(CipherType.Login, {
        id: "launched",
        localData: { lastLaunched: NOW },
      });
      autofillService.collectPageDetailsFromTab$.mockReturnValue(of([pd]));
      cipherService.getLastLaunchedForUrl.mockResolvedValue(launched);

      emitPageTransition(pd);
      await flushPromises();

      expect(cipherService.getLastLaunchedForUrl).toHaveBeenCalledWith(DEFAULT_URL, "user-1", true);
      expect(cipherService.getLastUsedForUrl).not.toHaveBeenCalled();
      expect(autofillService.doAutoFill).toHaveBeenCalledWith(
        expect.objectContaining({ cipher: launched }),
      );
    });

    it("falls back to the last-used cipher when the last-launched one is stale", async () => {
      const pd = pageDetail(1, 0);
      const stale = makeCipher(CipherType.Login, {
        id: "stale",
        localData: { lastLaunched: NOW - 60000 },
      });
      const lastUsed = makeCipher(CipherType.Login, { id: "last-used" });
      autofillService.collectPageDetailsFromTab$.mockReturnValue(of([pd]));
      cipherService.getLastLaunchedForUrl.mockResolvedValue(stale);
      cipherService.getLastUsedForUrl.mockResolvedValue(lastUsed);

      emitPageTransition(pd);
      await flushPromises();

      expect(autofillService.doAutoFill).toHaveBeenCalledWith(
        expect.objectContaining({ cipher: lastUsed }),
      );
    });

    it("does not fill when no cipher matches the url", async () => {
      const pd = pageDetail(1, 0);
      autofillService.collectPageDetailsFromTab$.mockReturnValue(of([pd]));
      cipherService.getLastUsedForUrl.mockResolvedValue(undefined as unknown as CipherView);

      emitPageTransition(pd);
      await flushPromises();

      expect(autofillService.doAutoFill).not.toHaveBeenCalled();
      expect(accountService.setAccountActivity).not.toHaveBeenCalled();
      expect(updateOverlayCiphers).not.toHaveBeenCalled();
    });

    it("abandons a reprompt-protected cipher on page load without surfacing a prompt", async () => {
      // A page-load fill (non-command) never opens a reprompt popout: a reprompt-protected cipher
      // is simply not filled, and the reprompt check is never reached.
      const pd = pageDetail(1, 0);
      autofillService.collectPageDetailsFromTab$.mockReturnValue(of([pd]));
      cipherService.getLastUsedForUrl.mockResolvedValue(
        makeCipher(CipherType.Login, { reprompt: CipherRepromptType.Password }),
      );

      emitPageTransition(pd);
      await flushPromises();

      expect(autofillService.isPasswordRepromptRequired).not.toHaveBeenCalled();
      expect(autofillService.doAutoFill).not.toHaveBeenCalled();
    });

    it("security: validates a sub-frame against its live frame url and scopes the collect to it", async () => {
      // Security bound (correct-origin): a credential reaches only the origin it was chosen for. A
      // sub-frame's url is not the tab's, so it is re-resolved live via getFrameDetails and the fill
      // proceeds only if the frame still shows the reported url. A non-zero frameId also guards the
      // collect against scoping to a hardcoded 0.
      const frameUrl = "https://idp.example.com/sso";
      // A sub-frame's collected url is the frame's own url, not the tab's.
      const pd = createPageDetailMock({
        frameId: 3,
        tab: createChromeTabMock({ id: 1 }),
        details: createAutofillPageDetailsMock({ url: frameUrl }),
      });
      autofillService.collectPageDetailsFromTab$.mockReturnValue(of([pd]));
      jest
        .spyOn(BrowserApi, "getFrameDetails")
        .mockResolvedValue(mock<chrome.webNavigation.GetFrameResultDetails>({ url: frameUrl }));

      emitPageTransition(pd, frameUrl);
      await flushPromises();

      expect(BrowserApi.getFrameDetails).toHaveBeenCalledWith({ tabId: 1, frameId: 3 });
      expect(autofillService.collectPageDetailsFromTab$).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1 }),
        3,
      );
      expect(autofillService.doAutoFill).toHaveBeenCalled();
    });

    it("security: abandons the fill when the reported sub-frame navigated in the resolve→fill gap", async () => {
      // Security bound (correct-origin): the frame navigated between reporting the opportunity and
      // the fill, so its live url no longer matches the one its cipher was chosen for. Filling the
      // stale cipher would hand a credential to the wrong origin, so the fill is abandoned.
      const pd = pageDetail(1, 3);
      jest
        .spyOn(BrowserApi, "getFrameDetails")
        .mockResolvedValue(
          mock<chrome.webNavigation.GetFrameResultDetails>({ url: "https://idp.example.com/sso" }),
        );

      emitPageTransition(pd, "https://idp.example.com/login");
      await flushPromises();

      expectAbandoned();
    });

    it("security: abandons the fill when the reported sub-frame no longer resolves", async () => {
      const pd = pageDetail(1, 3);
      jest
        .spyOn(BrowserApi, "getFrameDetails")
        .mockResolvedValue(null as unknown as chrome.webNavigation.GetFrameResultDetails);

      emitPageTransition(pd, "https://idp.example.com/sso");
      await flushPromises();

      expectAbandoned();
    });

    it("security: abandons the fill when resolving the reported sub-frame rejects", async () => {
      const pd = pageDetail(1, 3);
      jest.spyOn(BrowserApi, "getFrameDetails").mockRejectedValue(new Error("no frame"));

      emitPageTransition(pd, "https://idp.example.com/sso");
      await flushPromises();

      expectAbandoned();
    });

    it("does not fill, record activity, or refresh the overlay when the frame reports no page details", async () => {
      // An empty collection is not a fillable read, so the request abandons before the commit: no
      // fill is attempted, so no activity is booked and the overlay is not refreshed.
      autofillService.collectPageDetailsFromTab$.mockReturnValue(of([]));

      emitPageTransition(pageDetail(1, 0));
      await flushPromises();

      expect(accountService.setAccountActivity).not.toHaveBeenCalled();
      expect(autofillService.doAutoFill).not.toHaveBeenCalled();
      expect(platformUtilsService.copyToClipboard).not.toHaveBeenCalled();
      expect(updateOverlayCiphers).not.toHaveBeenCalled();
    });

    it("does not fill when the reported frame is fresh but has zero fields", async () => {
      // Isolates the fields guard from the freshness check: the url matches (frame is fresh), but
      // the collected detail has no fields, so the request abandons before the commit.
      const tab = createChromeTabMock({ id: 1 });
      const pd = createPageDetailMock({
        frameId: 0,
        tab,
        details: createAutofillPageDetailsMock({ url: tab.url, fields: [] }),
      });
      autofillService.collectPageDetailsFromTab$.mockReturnValue(of([pd]));

      emitPageTransition(pd);
      await flushPromises();

      expect(accountService.setAccountActivity).not.toHaveBeenCalled();
      expect(autofillService.doAutoFill).not.toHaveBeenCalled();
      expect(platformUtilsService.copyToClipboard).not.toHaveBeenCalled();
      expect(updateOverlayCiphers).not.toHaveBeenCalled();
    });

    it("abandons the fill when the tab id no longer resolves", async () => {
      jest.spyOn(BrowserApi, "getTab").mockResolvedValue(null as unknown as chrome.tabs.Tab);

      emitPageTransition(pageDetail(1, 0));
      await flushPromises();

      expectAbandoned();
    });

    it("abandons the fill when resolving the tab rejects", async () => {
      jest.spyOn(BrowserApi, "getTab").mockRejectedValue(new Error("no tab"));

      emitPageTransition(pageDetail(1, 0));
      await flushPromises();

      expectAbandoned();
      // The swallowed rejection must not surface as a logged error.
      expect(logService.error).not.toHaveBeenCalled();
    });

    it("security: abandons the fill when the resolved top-frame tab has navigated", async () => {
      // Security bound (correct-origin): the top frame's live url is the tab's, and it no longer
      // matches the reported url, so the cipher chosen for the old page is not filled into the new one.
      jest
        .spyOn(BrowserApi, "getTab")
        .mockResolvedValue(createChromeTabMock({ id: 1, url: "https://elsewhere.example" }));

      emitPageTransition(pageDetail(1, 0));
      await flushPromises();

      expectAbandoned();
    });

    it("security: refuses a page-load fill onto a tab that is not the foreground tab", async () => {
      // Security bound (foreground-only): a credential fills only the tab the user is working in. The
      // active-tab check lives in `commit` as defense-in-depth against a tab-switch race — the
      // opportunity resolved and the page was read, but the user moved to another tab before the
      // commit. The guard stays in `commit` regardless of upstream gating precisely to catch this
      // race, and drops the dispatch.
      const pd = pageDetail(1, 0);
      autofillService.collectPageDetailsFromTab$.mockReturnValue(of([pd]));
      jest
        .spyOn(BrowserApi, "getTabFromCurrentWindow")
        .mockResolvedValue(createChromeTabMock({ id: 2 }));

      emitPageTransition(pd);
      await flushPromises();

      // The read ran (the guard, not an earlier bail, is what stopped this) but the credential was
      // never dispatched to the non-foreground tab. No activity is booked either: a fill blocked for
      // being on the wrong tab must not keep the vault unlocked — that no-activity outcome is
      // intrinsic to the foreground bound, since the guard short-circuits before `doAutoFill` even
      // runs (a distinct path from a fill that dispatches and matches nothing).
      expect(autofillService.collectPageDetailsFromTab$).toHaveBeenCalled();
      expect(autofillService.doAutoFill).not.toHaveBeenCalled();
      expect(accountService.setAccountActivity).not.toHaveBeenCalled();
    });

    it("skips the fill entirely when autofill-on-page-load is disabled", async () => {
      autofillOnPageLoad$.next(false);

      emitPageTransition(pageDetail(1, 0));
      await flushPromises();

      expectAbandoned();
    });

    it("does not copy or refresh the overlay when the fill matched nothing", async () => {
      const pd = pageDetail(1, 0);
      autofillService.collectPageDetailsFromTab$.mockReturnValue(of([pd]));
      autofillService.doAutoFill.mockResolvedValue({ didAutofill: false });

      emitPageTransition(pd);
      await flushPromises();

      // Account activity, the overlay refresh, and the TOTP copy are all follow-ons of a fill that
      // used a credential; when the fill matched nothing (`didAutofill: false`) none of them run.
      expect(accountService.setAccountActivity).not.toHaveBeenCalled();
      expect(platformUtilsService.copyToClipboard).not.toHaveBeenCalled();
      expect(updateOverlayCiphers).not.toHaveBeenCalled();
    });

    it("security: abandons the fill when the frame navigates between validation and collection", async () => {
      // Security bound (correct-origin): resolveFreshTarget passes (the live tab still shows the
      // reported url), but the collected details carry a different url — a same-document navigation
      // landed in the gap between the pre-collect validation and the collect. The cipher would have
      // been chosen for the reported url, so the fill is abandoned before any commit-side effect runs.
      const pd = createPageDetailMock({
        frameId: 0,
        tab: createChromeTabMock({ id: 1 }),
        details: createAutofillPageDetailsMock({ url: "https://login.example.com/after-nav" }),
      });
      autofillService.collectPageDetailsFromTab$.mockReturnValue(of([pd]));

      emitPageTransition(pd, DEFAULT_URL);
      await flushPromises();

      expect(autofillService.doAutoFill).not.toHaveBeenCalled();
      expect(platformUtilsService.copyToClipboard).not.toHaveBeenCalled();
      expect(accountService.setAccountActivity).not.toHaveBeenCalled();
      expect(updateOverlayCiphers).not.toHaveBeenCalled();
    });
  });

  describe("user-initiated fills", () => {
    it("collects the tab and fills from a keyboard command with the full side effects", async () => {
      const pd = pageDetail(1, 0);
      const cipher = makeCipher(CipherType.Login);
      autofillService.collectPageDetailsFromTab$.mockReturnValue(of([pd]));
      cipherService.getNextCipherForUrl.mockResolvedValue(cipher);
      autofillService.doAutoFill.mockResolvedValue({ didAutofill: true, totp: "111111" });

      autofillOrchestrator.autofillActiveTabFromCommand(pd.tab);
      await flushPromises();

      // The orchestrator owns the collect: it asks for every frame (no frame id) rather than
      // being handed a pre-collected page detail.
      expect(autofillService.collectPageDetailsFromTab$).toHaveBeenCalledWith(pd.tab, undefined);
      // A command selects the next cipher in the url's rotation and fills with command options.
      expect(cipherService.getNextCipherForUrl).toHaveBeenCalledWith(DEFAULT_URL, "user-1");
      expect(accountService.setAccountActivity).toHaveBeenCalledWith("user-1", expect.any(Date));
      expect(autofillService.doAutoFill).toHaveBeenCalledWith(
        expect.objectContaining({
          tab: pd.tab,
          cipher,
          pageDetails: [pd],
          fillNewPassword: true,
          allowTotpAutofill: true,
        }),
      );
      // A successful command advances the url's last-used index once for the tab.
      expect(cipherService.updateLastUsedIndexForUrl).toHaveBeenCalledWith(DEFAULT_URL);
      expect(platformUtilsService.copyToClipboard).toHaveBeenCalledWith("111111");
      expect(updateOverlayCiphers).toHaveBeenCalledTimes(1);
    });

    it("cycles past the reprompt cipher and abandons the fill when a command surfaces a reprompt", async () => {
      const pd = pageDetail(1, 0);
      autofillService.collectPageDetailsFromTab$.mockReturnValue(of([pd]));
      autofillService.isPasswordRepromptRequired.mockResolvedValue(true);

      autofillOrchestrator.autofillActiveTabFromCommand(pd.tab);
      await flushPromises();

      // A command cycles past the reprompt-protected cipher so the next command offers the next one;
      // the fill itself is abandoned (no fill dispatched, no activity booked).
      expect(cipherService.updateLastUsedIndexForUrl).toHaveBeenCalledWith(DEFAULT_URL);
      expect(autofillService.doAutoFill).not.toHaveBeenCalled();
      expect(accountService.setAccountActivity).not.toHaveBeenCalled();
    });

    it("security: refuses a command fill once its tab is no longer the foreground tab", async () => {
      // Security bound (foreground-only): a credential fills only the tab the user is working in.
      // Switching tabs after issuing a command must not fill the tab the user switched to. The
      // active-tab check in `commit` is defense-in-depth against that tab-switch race and stays there;
      // it drops the dispatch even though the command was raised for a real tab.
      const pd = pageDetail(1, 0);
      autofillService.collectPageDetailsFromTab$.mockReturnValue(of([pd]));
      jest
        .spyOn(BrowserApi, "getTabFromCurrentWindow")
        .mockResolvedValue(createChromeTabMock({ id: 2 }));

      autofillOrchestrator.autofillActiveTabFromCommand(pd.tab);
      await flushPromises();

      // The read ran but the credential was never dispatched. A fill blocked for being on the wrong
      // tab must neither keep the vault unlocked (no activity) nor advance the rotation — both are
      // intrinsic to the foreground bound, since the guard short-circuits before `doAutoFill` runs.
      expect(autofillService.collectPageDetailsFromTab$).toHaveBeenCalled();
      expect(autofillService.doAutoFill).not.toHaveBeenCalled();
      expect(accountService.setAccountActivity).not.toHaveBeenCalled();
      expect(cipherService.updateLastUsedIndexForUrl).not.toHaveBeenCalled();
    });

    it.each([
      ["card", CipherType.Card, "cardCiphers", "getNextCardCipher"],
      ["identity", CipherType.Identity, "identityCiphers", "getNextIdentityCipher"],
    ] as const)(
      "collects the tab and fills a %s with no page-load/keyboard side effects",
      async (_label, cipherType, cacheKey, selector) => {
        const pd = pageDetail(1, 0);
        const cipher = makeCipher(cipherType);
        autofillService.collectPageDetailsFromTab$.mockReturnValue(of([pd]));
        // The row names the selection method for its type, so the case's cipher is wired without a
        // branch on cipherType.
        cipherService[selector].mockResolvedValue(cipher);
        autofillService.doAutoFill.mockResolvedValue({ didAutofill: true });

        autofillOrchestrator.autofillActiveTabForCipherType(pd.tab, cipherType);
        await flushPromises();

        expect(autofillService.doAutoFill).toHaveBeenCalledWith(
          expect.objectContaining({ tab: pd.tab, cipher, pageDetails: [pd] }),
        );
        // A card/identity fill advances its own rotation key, not the tab url.
        expect(cipherService.updateLastUsedIndexForUrl).toHaveBeenCalledWith(cacheKey);
        // A fill is account activity regardless of kind, so it is booked here too.
        expect(accountService.setAccountActivity).toHaveBeenCalledWith("user-1", expect.any(Date));
        // The login-only follow-ons (TOTP copy, overlay refresh) do not run for card/identity.
        expect(platformUtilsService.copyToClipboard).not.toHaveBeenCalled();
        expect(updateOverlayCiphers).not.toHaveBeenCalled();
      },
    );

    it("does not fill when the collect returns no page details", async () => {
      autofillService.collectPageDetailsFromTab$.mockReturnValue(of([]));

      autofillOrchestrator.autofillActiveTabFromCommand(pageDetail(1, 0).tab);
      await flushPromises();

      expect(autofillService.doAutoFill).not.toHaveBeenCalled();
      expect(accountService.setAccountActivity).not.toHaveBeenCalled();
    });

    it("drops a user-initiated fill that has no tab id", async () => {
      autofillOrchestrator.autofillActiveTabFromCommand(pageDetail(undefined, 0).tab);
      await flushPromises();

      expectAbandoned();
    });

    it("fills a tab-wide command when a fillable sub-frame answers behind an empty frame", async () => {
      // A tab-wide collect accumulates frames in message-arrival order, and the read drops the ones
      // with no fields, so an empty frame answering first cannot mask a fillable form in a sub-frame
      // that answers later: the read still yields the sub-frame, and the fill dispatches to it.
      const tab = createChromeTabMock({ id: 1 });
      const emptyFrame = createPageDetailMock({
        frameId: 0,
        tab,
        details: createAutofillPageDetailsMock({ url: tab.url, fields: [] }),
      });
      const fillableSubFrame = createPageDetailMock({
        frameId: 1,
        tab,
        // The fields are stated explicitly so this frame's fillability does not ride on the shared
        // mock's default field set.
        details: createAutofillPageDetailsMock({
          url: tab.url,
          fields: [createAutofillFieldMock()],
        }),
      });
      autofillService.collectPageDetailsFromTab$.mockReturnValue(
        of([emptyFrame, fillableSubFrame]),
      );
      const cipher = makeCipher(CipherType.Login);
      cipherService.getNextCipherForUrl.mockResolvedValue(cipher);
      autofillService.doAutoFill.mockResolvedValue({ didAutofill: true });

      autofillOrchestrator.autofillActiveTabFromCommand(tab);
      await flushPromises();

      expect(autofillService.doAutoFill).toHaveBeenCalledWith(
        expect.objectContaining({ tab, cipher, pageDetails: [fillableSubFrame] }),
      );
    });

    it("does not fill a tab-wide command when every frame reports zero fields", async () => {
      // The negative complement of the sub-frame case: a non-empty accumulation whose frames all
      // report zero fields is not fillable, so the fill abandons before the commit. This pins the
      // fillable-when-any-frame-has-fields semantics — a read is not fillable merely for having
      // frames.
      const tab = createChromeTabMock({ id: 1 });
      const frames = [0, 1].map((frameId) =>
        createPageDetailMock({
          frameId,
          tab,
          details: createAutofillPageDetailsMock({ url: tab.url, fields: [] }),
        }),
      );
      autofillService.collectPageDetailsFromTab$.mockReturnValue(of(frames));

      autofillOrchestrator.autofillActiveTabFromCommand(tab);
      await flushPromises();

      expect(autofillService.doAutoFill).not.toHaveBeenCalled();
      expect(accountService.setAccountActivity).not.toHaveBeenCalled();
    });

    it("security: refuses a command fill when the tab navigated away from the URL it targeted", async () => {
      // The command targets the tab's URL at the moment it is issued, but by commit time the same tab
      // shows a different URL. Filling now would place a cipher chosen for the old page onto the new
      // one, so the commit abandons it before `doAutoFill` is reached.
      const commandTab = createChromeTabMock({ id: 1, url: DEFAULT_URL });
      autofillService.collectPageDetailsFromTab$.mockReturnValue(of([pageDetail(1, 0)]));
      jest
        .spyOn(BrowserApi, "getTabFromCurrentWindow")
        .mockResolvedValue(createChromeTabMock({ id: 1, url: "https://navigated.example" }));

      autofillOrchestrator.autofillActiveTabFromCommand(commandTab);
      await flushPromises();

      expect(autofillService.collectPageDetailsFromTab$).toHaveBeenCalled();
      expect(autofillService.doAutoFill).not.toHaveBeenCalled();
      expect(accountService.setAccountActivity).not.toHaveBeenCalled();
      expect(cipherService.updateLastUsedIndexForUrl).not.toHaveBeenCalled();
    });
  });

  describe("serialization and tab-removal teardown", () => {
    it("security: serializes keyboard commands for the same tab and abandons a queued fill when the tab is removed", async () => {
      // Security bound (fills do not race): same-tab commands run one at a time so two fills of the
      // same scope cannot interleave into a double fill, and a fill queued behind an in-flight one is
      // abandoned rather than dispatched after its tab is gone.
      const pd = pageDetail(1, 0);
      autofillService.collectPageDetailsFromTab$.mockReturnValue(of([pd]));
      const inFlight = deferred();
      autofillService.doAutoFill.mockReturnValueOnce(inFlight.promise);

      // First command starts and blocks on the in-flight promise.
      autofillOrchestrator.autofillActiveTabFromCommand(pd.tab);
      await flushPromises();
      expect(autofillService.doAutoFill).toHaveBeenCalledTimes(1);

      // A command carries no frame id, so a second command for the same tab queues behind the
      // first rather than racing it.
      autofillOrchestrator.autofillActiveTabFromCommand(pd.tab);
      await flushPromises();
      expect(autofillService.doAutoFill).toHaveBeenCalledTimes(1);

      // The tab is removed while the first is in flight: the queued second is abandoned.
      removeTab(1);
      inFlight.resolve({ didAutofill: false });
      await flushPromises();

      expect(autofillService.doAutoFill).toHaveBeenCalledTimes(1);
    });

    it("runs page-load fills for different frames of the same tab concurrently", async () => {
      autofillService.collectPageDetailsFromTab$.mockImplementation((tab, frameId) =>
        of([pageDetail(1, frameId ?? 0)]),
      );
      const first = deferred();
      const second = deferred();
      autofillService.doAutoFill
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise);

      emitPageTransition(pageDetail(1, 0));
      emitPageTransition(pageDetail(1, 1));
      await flushPromises();

      // Neither has resolved, yet both are in flight — different frames do not serialize.
      expect(autofillService.doAutoFill).toHaveBeenCalledTimes(2);

      first.resolve({ didAutofill: false });
      second.resolve({ didAutofill: false });
      await flushPromises();
    });
  });

  describe("security: live-tab gate", () => {
    // The live-tab gate is a security control: it keeps a request naming a non-open tab id — a stale
    // or forged id — from opening a per-tab serialization group that nothing would later retire, and
    // never fails open.

    it("drops a page-load fill whose tab id is not an open tab", async () => {
      // No tab is open, so the reported transition's tab id is not live: the request is dropped
      // before it can open a per-tab serialization group that nothing would later retire.
      liveTabs$.next(new Set());

      emitPageTransition(pageDetail(1, 0));
      await flushPromises();

      expectAbandoned();
    });

    it("drops a user-initiated fill whose tab id is not an open tab", async () => {
      // Tab 1 is not among the open tabs, so a fill request naming it (e.g. a forged runtime
      // message) is dropped rather than keyed into a group.
      liveTabs$.next(new Set([2]));

      autofillOrchestrator.autofillActiveTabFromCommand(pageDetail(1, 0).tab);
      await flushPromises();

      expectAbandoned();
    });

    it("dispatches a fill whose tab id is an open tab", async () => {
      // The complement of the drop cases: a request for a live tab passes the gate and fills.
      liveTabs$.next(new Set([1]));
      autofillService.collectPageDetailsFromTab$.mockReturnValue(of([pageDetail(1, 0)]));

      autofillOrchestrator.autofillActiveTabFromCommand(pageDetail(1, 0).tab);
      await flushPromises();

      expect(autofillService.doAutoFill).toHaveBeenCalledTimes(1);
    });

    it("dispatches a page-load fill whose tab id is an open tab", async () => {
      // Page-load and user-initiated fills share the gated pipe; assert the page-load path
      // explicitly rather than relying on the default-open set in the page-load block.
      liveTabs$.next(new Set([1]));
      const pd = pageDetail(1, 0);
      autofillService.collectPageDetailsFromTab$.mockReturnValue(of([pd]));

      emitPageTransition(pd);
      await flushPromises();

      expect(autofillService.doAutoFill).toHaveBeenCalledTimes(1);
    });

    it("re-seeds and recovers when a later seed attempt succeeds", async () => {
      jest.useFakeTimers();
      // The dispatch pipe subscribes to `liveTabs$` at `init()`, so a failing seed stream must be substituted before
      // init. The beforeEach orchestrator has already seeded from the default (healthy) set and cannot be made to
      // fail after the fact.
      let attempt = 0;
      // The first subscription errors (seed fails); the retry's re-subscription succeeds.
      const flakyLiveTabs$ = defer(() =>
        attempt++ === 0 ? throwError(() => new Error("transient")) : of(new Set([1])),
      );
      (lifecycleService as any).liveTabs$ = flakyLiveTabs$;
      const orchestrator = construct();
      orchestrator.init();

      // Advancing past the retry delay re-seeds, and this attempt succeeds.
      await jest.advanceTimersByTimeAsync(LIVE_TAB_SEED_RETRY_DELAY_MS);
      expect(attempt).toBe(2);

      // The pipe is healthy again, so a fill dispatches through the gate — never failing open.
      autofillService.collectPageDetailsFromTab$.mockReturnValue(of([pageDetail(1, 0)]));
      orchestrator.autofillActiveTabFromCommand(pageDetail(1, 0).tab);
      await jest.advanceTimersByTimeAsync(0);

      expect(autofillService.doAutoFill).toHaveBeenCalledTimes(1);
      expect(logService.error).not.toHaveBeenCalled();
      jest.useRealTimers();
    });

    it("re-seeds up to the retry limit, then fails closed (logged)", async () => {
      jest.useFakeTimers();
      // Constructs its own orchestrator for the same reason as the recovery test: a seed that always
      // fails must be wired before `init()` subscribes to `liveTabs$`.
      let subscriptions = 0;
      // The seed never succeeds; the pipe resets a bounded number of times, then gives up.
      const alwaysErrors$ = defer(() => {
        subscriptions++;
        return throwError(() => new Error("seed failed"));
      });
      (lifecycleService as any).liveTabs$ = alwaysErrors$;
      const orchestrator = construct();
      orchestrator.init();

      await jest.advanceTimersByTimeAsync(LIVE_TAB_SEED_RETRY_DELAY_MS * LIVE_TAB_SEED_MAX_RETRIES);

      // Initial attempt plus the bounded retries — then it stops rather than looping.
      expect(subscriptions).toBe(LIVE_TAB_SEED_MAX_RETRIES + 1);
      expect(logService.error).toHaveBeenCalledWith(
        "Autofill dispatch stopped: live-tab set could not be established.",
        expect.any(Error),
      );

      // Fail closed: a fill after the pipe gives up is not dispatched (never gates open).
      orchestrator.autofillActiveTabFromCommand(pageDetail(1, 0).tab);
      await jest.advanceTimersByTimeAsync(0);
      expect(autofillService.doAutoFill).not.toHaveBeenCalled();
      jest.useRealTimers();
    });

    it("holds a fill until the live-tab set becomes available, then dispatches it", async () => {
      // Constructs its own orchestrator so the seed source is a stream that has not yet emitted at
      // `init()` time; the beforeEach orchestrator already seeded from a set that emitted immediately.
      const pendingLiveTabs$ = new Subject<ReadonlySet<number>>();
      (lifecycleService as any).liveTabs$ = pendingLiveTabs$;
      const orchestrator = construct();
      orchestrator.init();

      autofillService.collectPageDetailsFromTab$.mockReturnValue(of([pageDetail(1, 0)]));
      orchestrator.autofillActiveTabFromCommand(pageDetail(1, 0).tab);
      await flushPromises();
      // Not dispatched yet — the live-tab set has not emitted.
      expect(autofillService.doAutoFill).not.toHaveBeenCalled();

      pendingLiveTabs$.next(new Set([1]));
      await flushPromises();
      expect(autofillService.doAutoFill).toHaveBeenCalledTimes(1);
    });

    it("drops a forged-id request without disturbing a later live-tab fill", async () => {
      // The gate's purpose is to keep a forged id from opening a per-tab group that never retires.
      // A dropped forged request must not consume or reroute a subsequent legitimate fill.
      liveTabs$.next(new Set([1]));
      autofillService.collectPageDetailsFromTab$.mockReturnValue(of([pageDetail(1, 0)]));

      autofillOrchestrator.autofillActiveTabFromCommand(pageDetail(999, 0).tab);
      await flushPromises();
      expect(autofillService.doAutoFill).not.toHaveBeenCalled();

      autofillOrchestrator.autofillActiveTabFromCommand(pageDetail(1, 0).tab);
      await flushPromises();
      expect(autofillService.doAutoFill).toHaveBeenCalledTimes(1);
    });
  });

  describe("resilience", () => {
    it("logs and survives a failing fill so later fills still dispatch", async () => {
      autofillService.collectPageDetailsFromTab$.mockReturnValue(of([pageDetail(1, 0)]));
      autofillService.doAutoFill.mockRejectedValueOnce(new Error("boom"));

      autofillOrchestrator.autofillActiveTabFromCommand(pageDetail(1, 0).tab);
      await flushPromises();
      expect(logService.error).toHaveBeenCalledTimes(1);
      expect(logService.error).toHaveBeenCalledWith(expect.any(Error));

      autofillOrchestrator.autofillActiveTabFromCommand(pageDetail(1, 0).tab);
      await flushPromises();
      expect(autofillService.doAutoFill).toHaveBeenCalledTimes(2);
    });
  });

  describe("collection entries", () => {
    it("collectPageDetails resolves the settled page details for every frame", async () => {
      const pd = pageDetail(1, 0);
      autofillService.collectPageDetailsFromTab$.mockReturnValue(of([pd]));

      const result = await autofillOrchestrator.collectPageDetails(pd.tab);

      expect(autofillService.collectPageDetailsFromTab$).toHaveBeenCalledWith(pd.tab, undefined);
      expect(result).toEqual([pd]);
    });

    it("collectPageDetails scopes to a single frame when a frame id is given", async () => {
      const pd = pageDetail(1, 2);
      autofillService.collectPageDetailsFromTab$.mockReturnValue(of([pd]));

      await autofillOrchestrator.collectPageDetails(pd.tab, 2);

      expect(autofillService.collectPageDetailsFromTab$).toHaveBeenCalledWith(pd.tab, 2);
    });

    it("collectAutofillTriage resolves the tab's triage response", async () => {
      const triage = { pageDetails: {}, targetFieldRef: undefined } as any;
      jest
        .spyOn(BrowserApi, "sendTabsMessage")
        .mockImplementation(((_tabId: number, _message: any, _options: any, cb: any) =>
          cb(triage)) as any);

      const result = await autofillOrchestrator.collectAutofillTriage(1, 0);

      expect(result).toBe(triage);
    });

    it("collectAutofillTriage resolves undefined when the tab has no receiver", async () => {
      (chrome.runtime as any).lastError = { message: "Could not establish connection" };
      jest
        .spyOn(BrowserApi, "sendTabsMessage")
        .mockImplementation(((_tabId: number, _message: any, _options: any, cb: any) =>
          cb(undefined)) as any);

      const result = await autofillOrchestrator.collectAutofillTriage(1);

      expect(result).toBeUndefined();
      (chrome.runtime as any).lastError = undefined;
    });
  });

  describe("fillCipher", () => {
    it("fills a caller-supplied cipher into the foreground tab and returns the outcome", async () => {
      const tab = createChromeTabMock({ id: 1 });
      const pd = pageDetail(1, 0);
      autofillService.doAutoFill.mockResolvedValue({ didAutofill: true, totp: "999999" });

      const result = await autofillOrchestrator.fillCipher({
        tab,
        cipher: makeCipher(CipherType.Login),
        pageDetails: [pd],
      });

      expect(autofillService.doAutoFill).toHaveBeenCalledWith(
        expect.objectContaining({ tab, pageDetails: [pd] }),
      );
      expect(result).toEqual({ didAutofill: true, totp: "999999" });
    });

    it("security: refuses a caller-supplied fill onto a tab that is not the foreground tab", async () => {
      // The inline menu fills the content-script tab that requested it. Unlike `autofillTabWithCipher`,
      // this entry does not opt out of the foreground check — requiring the target to be the active
      // tab is defense-in-depth against a backgrounded frame's port driving a fill into itself.
      const tab = createChromeTabMock({ id: 1 });
      jest
        .spyOn(BrowserApi, "getTabFromCurrentWindow")
        .mockResolvedValue(createChromeTabMock({ id: 2 }));

      const result = await autofillOrchestrator.fillCipher({
        tab,
        cipher: makeCipher(CipherType.Login),
        pageDetails: [pageDetail(1, 0)],
      });

      expect(autofillService.doAutoFill).not.toHaveBeenCalled();
      expect(result).toEqual({ didAutofill: false });
    });
  });

  describe("autofillTabWithCipher", () => {
    it("collects the tab and fills the given cipher, returning the outcome", async () => {
      const pd = pageDetail(1, 0);
      const cipher = { id: "c1" } as any;
      autofillService.collectPageDetailsFromTab$.mockReturnValue(of([pd]));
      autofillService.doAutoFill.mockResolvedValue({ didAutofill: true, totp: "999999" });

      const result = await autofillOrchestrator.autofillTabWithCipher(pd.tab, cipher);

      expect(autofillService.doAutoFill).toHaveBeenCalledWith(
        expect.objectContaining({ tab: pd.tab, cipher, pageDetails: [pd] }),
      );
      expect(result).toEqual({ didAutofill: true, totp: "999999" });
      // A fill is account activity regardless of the entry point.
      expect(accountService.setAccountActivity).toHaveBeenCalledWith("user-1", expect.any(Date));
    });

    it("security: refuses to fill when the target is not the foreground tab", async () => {
      // The context menu's fill is foreground-verified like any other. If the target is not the
      // current-window active tab, the commit refuses it. (The opt-out lives in the sibling
      // `unsafeAutofillTabWithCipher`, exercised in its own block.)
      const pd = pageDetail(1, 0);
      autofillService.collectPageDetailsFromTab$.mockReturnValue(of([pd]));
      jest
        .spyOn(BrowserApi, "getTabFromCurrentWindow")
        .mockResolvedValue(createChromeTabMock({ id: 2 }));

      const result = await autofillOrchestrator.autofillTabWithCipher(pd.tab, { id: "c1" } as any);

      expect(autofillService.doAutoFill).not.toHaveBeenCalled();
      expect(result).toEqual({ didAutofill: false });
    });

    it("does not fill and reports didAutofill=false when the collect is empty", async () => {
      autofillService.collectPageDetailsFromTab$.mockReturnValue(of([]));

      const result = await autofillOrchestrator.autofillTabWithCipher(
        createChromeTabMock({ id: 1 }),
        { id: "c1" } as any,
      );

      expect(autofillService.doAutoFill).not.toHaveBeenCalled();
      expect(result).toEqual({ didAutofill: false });
    });
  });

  describe("unsafeAutofillTabWithCipher", () => {
    it("fills even when the target is not the current-window active tab", async () => {
      // An unsafe fill is not active-tab-verified: the single-action popout deliberately
      // fills its explicit sender tab, which need not be the current-window active tab.
      const pd = pageDetail(1, 0);
      autofillService.collectPageDetailsFromTab$.mockReturnValue(of([pd]));
      autofillService.doAutoFill.mockResolvedValue({ didAutofill: true });
      jest
        .spyOn(BrowserApi, "getTabFromCurrentWindow")
        .mockResolvedValue(createChromeTabMock({ id: 2 }));

      const result = await autofillOrchestrator.unsafeAutofillTabWithCipher(pd.tab, {
        id: "c1",
      } as any);

      expect(autofillService.doAutoFill).toHaveBeenCalled();
      expect(result).toEqual({ didAutofill: true });
    });

    it("does not fill and reports didAutofill=false when the collect is empty", async () => {
      autofillService.collectPageDetailsFromTab$.mockReturnValue(of([]));

      const result = await autofillOrchestrator.unsafeAutofillTabWithCipher(
        createChromeTabMock({ id: 1 }),
        { id: "c1" } as any,
      );

      expect(autofillService.doAutoFill).not.toHaveBeenCalled();
      expect(result).toEqual({ didAutofill: false });
    });

    it("abandons an unsafe fill when the target tab navigated since it was captured", async () => {
      const target = createChromeTabMock({ id: 1, url: DEFAULT_URL });
      autofillService.collectPageDetailsFromTab$.mockReturnValue(of([pageDetail(1, 0)]));
      autofillService.doAutoFill.mockResolvedValue({ didAutofill: true });
      jest
        .spyOn(BrowserApi, "getTab")
        .mockResolvedValue(createChromeTabMock({ id: 1, url: "https://navigated.example" }));

      const result = await autofillOrchestrator.unsafeAutofillTabWithCipher(target, {
        id: "c1",
      } as any);

      expect(autofillService.doAutoFill).not.toHaveBeenCalled();
      expect(result).toEqual({ didAutofill: false });
    });
  });

  describe("autoSubmitLoginOnTab", () => {
    it("collects the reporting frame and fills it with the auto-submit script", async () => {
      const pd = pageDetail(1, 0);
      const cipher = makeCipher(CipherType.Login);
      autofillService.collectPageDetailsFromTab$.mockReturnValue(of([pd]));
      cipherService.getNextCipherForUrl.mockResolvedValue(cipher);

      autofillService.doAutoFill.mockResolvedValue({ didAutofill: true });

      await autofillOrchestrator["autoSubmitLoginOnTab"](pd.tab, 0);

      expect(autofillService.collectPageDetailsFromTab$).toHaveBeenCalledWith(pd.tab, 0);
      expect(autofillService.doAutoFill).toHaveBeenCalledWith(
        expect.objectContaining({
          tab: pd.tab,
          cipher,
          pageDetails: [pd],
          autoSubmitLogin: true,
        }),
      );
      // A submit that filled used a credential, so the url's rotation advances (inside commit).
      expect(cipherService.updateLastUsedIndexForUrl).toHaveBeenCalledWith(pd.tab.url);
    });

    it("does not fill when the frame has no page details to submit", async () => {
      autofillService.collectPageDetailsFromTab$.mockReturnValue(of([]));

      await autofillOrchestrator["autoSubmitLoginOnTab"](createChromeTabMock({ id: 1 }), 0);

      expect(autofillService.doAutoFill).not.toHaveBeenCalled();
    });

    it("security: refuses to fill-and-submit onto a tab that is not the foreground tab", async () => {
      // Security bound (foreground-only): a submit both fills *and* transmits a credential, so it runs
      // through the same `commit` active-tab check as any other fill. That check is defense-in-depth
      // against a tab-switch race and stays in `commit`; it drops the submit when the tab is no longer
      // foreground.
      const pd = pageDetail(1, 0);
      autofillService.collectPageDetailsFromTab$.mockReturnValue(of([pd]));
      jest
        .spyOn(BrowserApi, "getTabFromCurrentWindow")
        .mockResolvedValue(createChromeTabMock({ id: 2 }));

      await autofillOrchestrator["autoSubmitLoginOnTab"](pd.tab, 0);

      // The read ran but no credential was filled or submitted to the non-foreground tab, and no
      // activity was booked — the guard short-circuits before `doAutoFill`, so a blocked submit
      // cannot keep the vault unlocked.
      expect(autofillService.collectPageDetailsFromTab$).toHaveBeenCalled();
      expect(autofillService.doAutoFill).not.toHaveBeenCalled();
      expect(accountService.setAccountActivity).not.toHaveBeenCalled();
    });
  });

  describe("automatedLoginStepReady$ consumer", () => {
    it("interprets an auto-submit step-ready fact as a collect → fill → submit", async () => {
      const pd = pageDetail(1, 0);
      autofillService.collectPageDetailsFromTab$.mockReturnValue(of([pd]));

      emitAutomatedLoginStep(pd);
      await flushPromises();

      expect(autofillService.collectPageDetailsFromTab$).toHaveBeenCalledWith(pd.tab, pd.frameId);
      expect(autofillService.doAutoFill).toHaveBeenCalledWith(
        expect.objectContaining({ pageDetails: [pd], autoSubmitLogin: true }),
      );
    });
  });
});
