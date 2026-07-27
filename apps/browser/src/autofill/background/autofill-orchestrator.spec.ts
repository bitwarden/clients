import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, defer, filter, map, of, Subject, throwError } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AutofillSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/autofill-settings.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherType } from "@bitwarden/common/vault/enums";

import { BrowserApi } from "../../platform/browser/browser-api";
import {
  AutofillLifecycleService,
  PageTransitionResolved,
} from "../services/abstractions/autofill-lifecycle.service";
import { AutofillService, PageDetail } from "../services/abstractions/autofill.service";
import {
  createAutofillPageDetailsMock,
  createChromeTabMock,
  createPageDetailMock,
} from "../spec/autofill-mocks";
import { flushPromises } from "../spec/testing-utils";

import {
  AutofillOrchestrator,
  LIVE_TAB_SEED_MAX_RETRIES,
  LIVE_TAB_SEED_RETRY_DELAY_MS,
} from "./autofill-orchestrator";

describe("AutofillOrchestrator", () => {
  let autofillOrchestrator: AutofillOrchestrator;
  let lifecycleService: MockProxy<AutofillLifecycleService>;
  let autofillService: MockProxy<AutofillService>;
  let autofillSettingsService: MockProxy<AutofillSettingsServiceAbstraction>;
  let accountService: MockProxy<AccountService>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let updateOverlayCiphers: jest.Mock<Promise<void>, []>;
  const logService = mock<LogService>();

  let pageTransitionResolved$: Subject<PageTransitionResolved>;
  let tabRemovedSubject$: Subject<number>;
  let autofillOnPageLoad$: BehaviorSubject<boolean>;
  let liveTabs$: BehaviorSubject<ReadonlySet<number>>;

  // createChromeTabMock's default url; the live tab and reported frame url share it by default so
  // the fill-time match succeeds unless a test overrides one side.
  const DEFAULT_URL = "https://jest-testing-website.com";

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

  // A promise whose resolution the test controls, so it can hold a fill in flight.
  const deferred = () => {
    let resolve!: (value: string | null) => void;
    const promise = new Promise<string | null>((r) => (resolve = r));
    return { promise, resolve };
  };

  // Every abandon path bails before the collect→fill step, so none of the fill's work or side
  // effects run. Asserting collect was not called is the load-bearing signal for a security fix:
  // it proves the guard fired, not that a downstream short-circuit happened to skip the fill.
  const expectAbandoned = () => {
    expect(autofillService.collectPageDetailsFromTab$).not.toHaveBeenCalled();
    expect(autofillService.doAutoFillOnTab).not.toHaveBeenCalled();
    expect(accountService.setAccountActivity).not.toHaveBeenCalled();
    expect(updateOverlayCiphers).not.toHaveBeenCalled();
  };

  beforeEach(() => {
    pageTransitionResolved$ = new Subject<PageTransitionResolved>();
    tabRemovedSubject$ = new Subject<number>();
    autofillOnPageLoad$ = new BehaviorSubject<boolean>(true);
    // The tabs used across these tests are open by default so requests pass the live-tab gate;
    // the gate tests below override this to exercise the drop path (empty set) and the seed-error
    // fail-open path.
    liveTabs$ = new BehaviorSubject<ReadonlySet<number>>(new Set([1, 2]));

    lifecycleService = mock<AutofillLifecycleService>();
    (lifecycleService as any).pageTransitionResolved$ = pageTransitionResolved$;
    (lifecycleService as any).liveTabs$ = liveTabs$;
    lifecycleService.tabRemoved$.mockImplementation((tabId: number) =>
      tabRemovedSubject$.pipe(
        filter((removedTabId) => removedTabId === tabId),
        map((): void => undefined),
      ),
    );

    autofillService = mock<AutofillService>();
    autofillService.collectPageDetailsFromTab$.mockReturnValue(of([]));
    autofillService.doAutoFillActiveTab.mockResolvedValue(null);
    autofillService.doAutoFillOnTab.mockResolvedValue(null);

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

    autofillOrchestrator = new AutofillOrchestrator(
      lifecycleService,
      autofillService,
      autofillSettingsService,
      accountService,
      platformUtilsService,
      updateOverlayCiphers,
      logService,
    );
    autofillOrchestrator.init();
  });

  // `logService` is a module-level mock reused across tests; clear it (and the
  // per-test spies) so counts and call history don't bleed between cases.
  afterEach(() => jest.clearAllMocks());

  describe("page-load fills", () => {
    it("resolves the target by id, validates the frame url, collects the reported frame, records activity, fills, copies the TOTP, and refreshes the overlay", async () => {
      // The top frame's live url (the tab's) matches the reported frame url, so the fill proceeds.
      const url = "https://login.example.com/session";
      const pd = createPageDetailMock({
        frameId: 0,
        tab: createChromeTabMock({ id: 1, url }),
        details: createAutofillPageDetailsMock({ url }),
      });
      autofillService.collectPageDetailsFromTab$.mockReturnValue(of([pd]));
      jest.spyOn(BrowserApi, "getTab").mockResolvedValue(createChromeTabMock({ id: 1, url }));
      autofillService.doAutoFillOnTab.mockResolvedValue("999999");

      emitPageTransition(pd);
      await flushPromises();

      expect(BrowserApi.getTab).toHaveBeenCalledWith(1);
      // Collect is scoped to the reported frame and targets the live tab, not the seam snapshot.
      expect(autofillService.collectPageDetailsFromTab$).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1, url }),
        0,
      );
      expect(accountService.setAccountActivity).toHaveBeenCalledWith("user-1", expect.any(Date));
      // fromCommand is false for page-load fills; the fill targets the live tab and never falls
      // back to the active-tab path.
      expect(autofillService.doAutoFillOnTab).toHaveBeenCalledWith(
        [pd],
        expect.objectContaining({ id: 1, url }),
        false,
      );
      expect(autofillService.doAutoFillActiveTab).not.toHaveBeenCalled();
      expect(platformUtilsService.copyToClipboard).toHaveBeenCalledWith("999999");
      expect(updateOverlayCiphers).toHaveBeenCalledTimes(1);

      // The order is behavior-preserving and load-bearing: collect before fill
      // (atomic per frame), account activity before the fill, and TOTP copy then
      // overlay refresh after it.
      expect(autofillService.collectPageDetailsFromTab$.mock.invocationCallOrder[0]).toBeLessThan(
        accountService.setAccountActivity.mock.invocationCallOrder[0],
      );
      expect(accountService.setAccountActivity.mock.invocationCallOrder[0]).toBeLessThan(
        autofillService.doAutoFillOnTab.mock.invocationCallOrder[0],
      );
      expect(autofillService.doAutoFillOnTab.mock.invocationCallOrder[0]).toBeLessThan(
        platformUtilsService.copyToClipboard.mock.invocationCallOrder[0],
      );
      expect(platformUtilsService.copyToClipboard.mock.invocationCallOrder[0]).toBeLessThan(
        updateOverlayCiphers.mock.invocationCallOrder[0],
      );
    });

    it("validates a sub-frame against its live frame url and scopes the collect to it", async () => {
      // A sub-frame's url is not the tab's, so it is validated via getFrameDetails; a non-zero
      // frameId also guards the collect against scoping to a hardcoded 0.
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
      expect(autofillService.doAutoFillOnTab).toHaveBeenCalled();
    });

    it("abandons the fill when the reported sub-frame has navigated", async () => {
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

    it("abandons the fill when the reported sub-frame no longer resolves", async () => {
      const pd = pageDetail(1, 3);
      jest
        .spyOn(BrowserApi, "getFrameDetails")
        .mockResolvedValue(null as unknown as chrome.webNavigation.GetFrameResultDetails);

      emitPageTransition(pd, "https://idp.example.com/sso");
      await flushPromises();

      expectAbandoned();
    });

    it("abandons the fill when resolving the reported sub-frame rejects", async () => {
      const pd = pageDetail(1, 3);
      jest.spyOn(BrowserApi, "getFrameDetails").mockRejectedValue(new Error("no frame"));

      emitPageTransition(pd, "https://idp.example.com/sso");
      await flushPromises();

      expectAbandoned();
    });

    it("records activity and refreshes the overlay but does not fill when the frame has no fields", async () => {
      // An empty collection short-circuits before doAutoFillOnTab (which throws on empty details),
      // while the surrounding side effects still run.
      autofillService.collectPageDetailsFromTab$.mockReturnValue(of([]));

      emitPageTransition(pageDetail(1, 0));
      await flushPromises();

      expect(accountService.setAccountActivity).toHaveBeenCalledWith("user-1", expect.any(Date));
      expect(autofillService.doAutoFillOnTab).not.toHaveBeenCalled();
      expect(platformUtilsService.copyToClipboard).not.toHaveBeenCalled();
      expect(updateOverlayCiphers).toHaveBeenCalledTimes(1);
    });

    it("does not fill when the reported frame is fresh but has zero fields", async () => {
      // Isolates the fields guard from the freshness check: the url matches (frame is fresh), but
      // the collected detail has no fields, so doAutoFillOnTab (which throws on empty details) must
      // still be skipped while the side effects run.
      const tab = createChromeTabMock({ id: 1 });
      const pd = createPageDetailMock({
        frameId: 0,
        tab,
        details: createAutofillPageDetailsMock({ url: tab.url, fields: [] }),
      });
      autofillService.collectPageDetailsFromTab$.mockReturnValue(of([pd]));

      emitPageTransition(pd);
      await flushPromises();

      expect(accountService.setAccountActivity).toHaveBeenCalledWith("user-1", expect.any(Date));
      expect(autofillService.doAutoFillOnTab).not.toHaveBeenCalled();
      expect(platformUtilsService.copyToClipboard).not.toHaveBeenCalled();
      expect(updateOverlayCiphers).toHaveBeenCalledTimes(1);
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

    it("abandons the fill when the resolved tab has navigated", async () => {
      jest
        .spyOn(BrowserApi, "getTab")
        .mockResolvedValue(createChromeTabMock({ id: 1, url: "https://elsewhere.example" }));

      emitPageTransition(pageDetail(1, 0));
      await flushPromises();

      expectAbandoned();
    });

    // FIXME (PM-39579): remove with the temporary active-tab guard once the tab gate lands.
    it("abandons the page-load fill when the tab is not the active tab", async () => {
      jest
        .spyOn(BrowserApi, "getTabFromCurrentWindow")
        .mockResolvedValue(createChromeTabMock({ id: 2 }));

      emitPageTransition(pageDetail(1, 0));
      await flushPromises();

      expectAbandoned();
    });

    it("skips the fill entirely when autofill-on-page-load is disabled", async () => {
      autofillOnPageLoad$.next(false);

      emitPageTransition(pageDetail(1, 0));
      await flushPromises();

      expect(BrowserApi.getTab).not.toHaveBeenCalled();
      expect(autofillService.collectPageDetailsFromTab$).not.toHaveBeenCalled();
      expect(autofillService.doAutoFillOnTab).not.toHaveBeenCalled();
      expect(accountService.setAccountActivity).not.toHaveBeenCalled();
    });

    it("does not copy to the clipboard when the fill returns no TOTP", async () => {
      const pd = pageDetail(1, 0);
      autofillService.collectPageDetailsFromTab$.mockReturnValue(of([pd]));
      autofillService.doAutoFillOnTab.mockResolvedValue(null);

      emitPageTransition(pd);
      await flushPromises();

      expect(platformUtilsService.copyToClipboard).not.toHaveBeenCalled();
      // The overlay refresh is part of the page-load side effects and runs regardless.
      expect(updateOverlayCiphers).toHaveBeenCalledTimes(1);
    });

    it("abandons the fill when the frame navigates between validation and collection", async () => {
      // resolveFreshTarget passes (the live tab still shows the reported url), but the collected
      // details carry a different url: a same-document navigation landed in the gap between the
      // pre-collect validation and the collect. The cipher would have been chosen for the reported
      // url, so the fill is abandoned rather than applied to the page now loaded.
      const pd = createPageDetailMock({
        frameId: 0,
        tab: createChromeTabMock({ id: 1 }),
        details: createAutofillPageDetailsMock({ url: "https://login.example.com/after-nav" }),
      });
      autofillService.collectPageDetailsFromTab$.mockReturnValue(of([pd]));

      emitPageTransition(pd, DEFAULT_URL);
      await flushPromises();

      expect(autofillService.doAutoFillOnTab).not.toHaveBeenCalled();
      expect(platformUtilsService.copyToClipboard).not.toHaveBeenCalled();
      // The abandon mirrors the empty-collection path: activity and overlay refresh still run.
      expect(accountService.setAccountActivity).toHaveBeenCalledWith("user-1", expect.any(Date));
      expect(updateOverlayCiphers).toHaveBeenCalledTimes(1);
    });
  });

  describe("user-initiated fills", () => {
    it("fills the active tab from a keyboard command with the full side effects", async () => {
      const pd = pageDetail(1, 0);
      autofillService.doAutoFillActiveTab.mockResolvedValue("111111");

      autofillOrchestrator.autofillActiveTabFromCommand(pd);
      await flushPromises();

      expect(accountService.setAccountActivity).toHaveBeenCalledWith("user-1", expect.any(Date));
      expect(autofillService.doAutoFillActiveTab).toHaveBeenCalledWith([pd], true);
      expect(platformUtilsService.copyToClipboard).toHaveBeenCalledWith("111111");
      expect(updateOverlayCiphers).toHaveBeenCalledTimes(1);
    });

    it.each([
      ["card", CipherType.Card],
      ["identity", CipherType.Identity],
    ] as const)(
      "fills a %s with no page-load/keyboard side effects",
      async (_label, cipherType) => {
        const pd = pageDetail(1, 0);

        autofillOrchestrator.autofillActiveTabForCipherType(pd, cipherType);
        await flushPromises();

        expect(autofillService.doAutoFillActiveTab).toHaveBeenCalledWith([pd], true, cipherType);
        expect(accountService.setAccountActivity).not.toHaveBeenCalled();
        expect(platformUtilsService.copyToClipboard).not.toHaveBeenCalled();
        expect(updateOverlayCiphers).not.toHaveBeenCalled();
      },
    );

    it("drops a user-initiated fill that has no tab id", async () => {
      autofillOrchestrator.autofillActiveTabFromCommand(pageDetail(undefined, 0));
      await flushPromises();

      expect(autofillService.doAutoFillActiveTab).not.toHaveBeenCalled();
    });
  });

  describe("serialization and tab-removal teardown", () => {
    it("serializes fills for the same (tab, frame) and abandons a queued fill when the tab is removed", async () => {
      const inFlight = deferred();
      autofillService.doAutoFillActiveTab.mockReturnValueOnce(inFlight.promise);

      // First fill starts and blocks on the in-flight promise.
      autofillOrchestrator.autofillActiveTabFromCommand(pageDetail(1, 0));
      await flushPromises();
      expect(autofillService.doAutoFillActiveTab).toHaveBeenCalledTimes(1);

      // Second fill for the same (tab, frame) queues behind the first.
      autofillOrchestrator.autofillActiveTabFromCommand(pageDetail(1, 0));
      await flushPromises();
      expect(autofillService.doAutoFillActiveTab).toHaveBeenCalledTimes(1);

      // The tab is removed while the first is in flight: the queued second is abandoned.
      removeTab(1);
      inFlight.resolve(null);
      await flushPromises();

      expect(autofillService.doAutoFillActiveTab).toHaveBeenCalledTimes(1);
    });

    it("runs fills for different frames of the same tab concurrently", async () => {
      const first = deferred();
      const second = deferred();
      autofillService.doAutoFillActiveTab
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise);

      autofillOrchestrator.autofillActiveTabFromCommand(pageDetail(1, 0));
      autofillOrchestrator.autofillActiveTabFromCommand(pageDetail(1, 1));
      await flushPromises();

      // Neither has resolved, yet both are in flight — different frames do not serialize.
      expect(autofillService.doAutoFillActiveTab).toHaveBeenCalledTimes(2);

      first.resolve(null);
      second.resolve(null);
      await flushPromises();
    });

    it("serializes a user-initiated fill behind an in-flight page-load fill on the same frame", async () => {
      const pd = pageDetail(1, 0);
      autofillService.collectPageDetailsFromTab$.mockReturnValue(of([pd]));
      const pageLoadFill = deferred();
      autofillService.doAutoFillOnTab.mockReturnValueOnce(pageLoadFill.promise);

      // A page-load fill (doAutoFillOnTab) starts and blocks in flight.
      emitPageTransition(pd);
      await flushPromises();
      expect(autofillService.doAutoFillOnTab).toHaveBeenCalledTimes(1);

      // A keyboard fill (doAutoFillActiveTab) for the same (tab, frame) queues behind it rather
      // than racing — the two flavors share one serialized entry point.
      autofillOrchestrator.autofillActiveTabFromCommand(pd);
      await flushPromises();
      expect(autofillService.doAutoFillActiveTab).not.toHaveBeenCalled();

      // Once the page-load fill completes, the queued keyboard fill runs.
      pageLoadFill.resolve(null);
      await flushPromises();
      expect(autofillService.doAutoFillActiveTab).toHaveBeenCalledTimes(1);
    });
  });

  describe("live-tab gate", () => {
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

      autofillOrchestrator.autofillActiveTabFromCommand(pageDetail(1, 0));
      await flushPromises();

      expect(autofillService.doAutoFillActiveTab).not.toHaveBeenCalled();
    });

    it("dispatches a fill whose tab id is an open tab", async () => {
      // The complement of the drop cases: a request for a live tab passes the gate and fills.
      liveTabs$.next(new Set([1]));

      autofillOrchestrator.autofillActiveTabFromCommand(pageDetail(1, 0));
      await flushPromises();

      expect(autofillService.doAutoFillActiveTab).toHaveBeenCalledTimes(1);
    });

    it("dispatches a page-load fill whose tab id is an open tab", async () => {
      // Page-load and user-initiated fills share the gated pipe; assert the page-load path
      // explicitly rather than relying on the default-open set in the page-load block.
      liveTabs$.next(new Set([1]));
      const pd = pageDetail(1, 0);
      autofillService.collectPageDetailsFromTab$.mockReturnValue(of([pd]));

      emitPageTransition(pd);
      await flushPromises();

      expect(autofillService.doAutoFillOnTab).toHaveBeenCalledTimes(1);
    });

    it("re-seeds and recovers when a later seed attempt succeeds", async () => {
      jest.useFakeTimers();
      // The first subscription errors (seed fails); the retry's re-subscription succeeds.
      let attempt = 0;
      const flakyLiveTabs$ = defer(() =>
        attempt++ === 0 ? throwError(() => new Error("transient")) : of(new Set([1])),
      );
      (lifecycleService as any).liveTabs$ = flakyLiveTabs$;
      const orchestrator = new AutofillOrchestrator(
        lifecycleService,
        autofillService,
        autofillSettingsService,
        accountService,
        platformUtilsService,
        updateOverlayCiphers,
        logService,
      );
      orchestrator.init();

      // Advancing past the retry delay re-seeds, and this attempt succeeds.
      await jest.advanceTimersByTimeAsync(LIVE_TAB_SEED_RETRY_DELAY_MS);
      expect(attempt).toBe(2);

      // The pipe is healthy again, so a fill dispatches through the gate — never failing open.
      orchestrator.autofillActiveTabFromCommand(pageDetail(1, 0));
      await jest.advanceTimersByTimeAsync(0);

      expect(autofillService.doAutoFillActiveTab).toHaveBeenCalledTimes(1);
      expect(logService.error).not.toHaveBeenCalled();
      jest.useRealTimers();
    });

    it("re-seeds up to the retry limit, then fails closed (logged)", async () => {
      jest.useFakeTimers();
      // The seed never succeeds; the pipe resets a bounded number of times, then gives up.
      let subscriptions = 0;
      const alwaysErrors$ = defer(() => {
        subscriptions++;
        return throwError(() => new Error("seed failed"));
      });
      (lifecycleService as any).liveTabs$ = alwaysErrors$;
      const orchestrator = new AutofillOrchestrator(
        lifecycleService,
        autofillService,
        autofillSettingsService,
        accountService,
        platformUtilsService,
        updateOverlayCiphers,
        logService,
      );
      orchestrator.init();

      await jest.advanceTimersByTimeAsync(LIVE_TAB_SEED_RETRY_DELAY_MS * LIVE_TAB_SEED_MAX_RETRIES);

      // Initial attempt plus the bounded retries — then it stops rather than looping.
      expect(subscriptions).toBe(LIVE_TAB_SEED_MAX_RETRIES + 1);
      expect(logService.error).toHaveBeenCalledWith(
        "Autofill dispatch stopped: live-tab set could not be established.",
        expect.any(Error),
      );

      // Fail closed: a fill after the pipe gives up is not dispatched (never gates open).
      orchestrator.autofillActiveTabFromCommand(pageDetail(1, 0));
      await jest.advanceTimersByTimeAsync(0);
      expect(autofillService.doAutoFillActiveTab).not.toHaveBeenCalled();
      jest.useRealTimers();
    });

    it("holds a fill until the live-tab set becomes available, then dispatches it", async () => {
      // `withLatestReady`: a fill arriving before the startup seed resolves waits for the
      // authoritative set instead of slipping through ungated or being dropped.
      const pendingLiveTabs$ = new Subject<ReadonlySet<number>>();
      (lifecycleService as any).liveTabs$ = pendingLiveTabs$;
      const orchestrator = new AutofillOrchestrator(
        lifecycleService,
        autofillService,
        autofillSettingsService,
        accountService,
        platformUtilsService,
        updateOverlayCiphers,
        logService,
      );
      orchestrator.init();

      orchestrator.autofillActiveTabFromCommand(pageDetail(1, 0));
      await flushPromises();
      // Not dispatched yet — the live-tab set has not emitted.
      expect(autofillService.doAutoFillActiveTab).not.toHaveBeenCalled();

      pendingLiveTabs$.next(new Set([1]));
      await flushPromises();
      expect(autofillService.doAutoFillActiveTab).toHaveBeenCalledTimes(1);
    });

    it("drops a forged-id request without disturbing a later live-tab fill", async () => {
      // The gate's purpose is to keep a forged id from opening a per-tab group that never retires.
      // A dropped forged request must not consume or reroute a subsequent legitimate fill.
      liveTabs$.next(new Set([1]));

      autofillOrchestrator.autofillActiveTabFromCommand(pageDetail(999, 0));
      await flushPromises();
      expect(autofillService.doAutoFillActiveTab).not.toHaveBeenCalled();

      autofillOrchestrator.autofillActiveTabFromCommand(pageDetail(1, 0));
      await flushPromises();
      expect(autofillService.doAutoFillActiveTab).toHaveBeenCalledTimes(1);
    });
  });

  describe("resilience", () => {
    it("logs and survives a failing fill so later fills still dispatch", async () => {
      autofillService.doAutoFillActiveTab.mockRejectedValueOnce(new Error("boom"));

      autofillOrchestrator.autofillActiveTabFromCommand(pageDetail(1, 0));
      await flushPromises();
      expect(logService.error).toHaveBeenCalledTimes(1);
      expect(logService.error).toHaveBeenCalledWith(expect.any(Error));

      autofillOrchestrator.autofillActiveTabFromCommand(pageDetail(1, 0));
      await flushPromises();
      expect(autofillService.doAutoFillActiveTab).toHaveBeenCalledTimes(2);
    });
  });
});
