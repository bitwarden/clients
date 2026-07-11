import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, filter, map, of, Subject } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AutofillSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/autofill-settings.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherType } from "@bitwarden/common/vault/enums";

import {
  AutofillLifecycleService,
  PageTransitionResolved,
} from "../services/abstractions/autofill-lifecycle.service";
import { AutofillService, PageDetail } from "../services/abstractions/autofill.service";
import { createChromeTabMock, createPageDetailMock } from "../spec/autofill-mocks";
import { flushPromises } from "../spec/testing-utils";

import { AutofillOrchestrator } from "./autofill-orchestrator";

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

  const pageDetail = (tabId: number | undefined, frameId: number): PageDetail =>
    createPageDetailMock({ frameId, tab: createChromeTabMock({ id: tabId }) });

  const emitPageTransition = (pd: PageDetail) =>
    pageTransitionResolved$.next({ tab: pd.tab, tabId: pd.tab.id!, frameId: pd.frameId });

  const removeTab = (tabId: number) => tabRemovedSubject$.next(tabId);

  // A promise whose resolution the test controls, so it can hold a fill in flight.
  const deferred = () => {
    let resolve!: (value: string | null) => void;
    const promise = new Promise<string | null>((r) => (resolve = r));
    return { promise, resolve };
  };

  beforeEach(() => {
    pageTransitionResolved$ = new Subject<PageTransitionResolved>();
    tabRemovedSubject$ = new Subject<number>();
    autofillOnPageLoad$ = new BehaviorSubject<boolean>(true);

    lifecycleService = mock<AutofillLifecycleService>();
    (lifecycleService as any).pageTransitionResolved$ = pageTransitionResolved$;
    lifecycleService.tabRemoved$.mockImplementation((tabId: number) =>
      tabRemovedSubject$.pipe(
        filter((removedTabId) => removedTabId === tabId),
        map((): void => undefined),
      ),
    );

    autofillService = mock<AutofillService>();
    autofillService.collectPageDetailsFromTab$.mockReturnValue(of([]));
    autofillService.doAutoFillActiveTab.mockResolvedValue(null);

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
    it("collects, records activity, fills, copies the TOTP, and refreshes the overlay", async () => {
      const pd = pageDetail(1, 0);
      autofillService.collectPageDetailsFromTab$.mockReturnValue(of([pd]));
      autofillService.doAutoFillActiveTab.mockResolvedValue("999999");

      emitPageTransition(pd);
      await flushPromises();

      expect(autofillService.collectPageDetailsFromTab$).toHaveBeenCalledWith(pd.tab);
      expect(accountService.setAccountActivity).toHaveBeenCalledWith("user-1", expect.any(Date));
      // fromCommand is false for page-load fills.
      expect(autofillService.doAutoFillActiveTab).toHaveBeenCalledWith([pd], false);
      expect(platformUtilsService.copyToClipboard).toHaveBeenCalledWith("999999");
      expect(updateOverlayCiphers).toHaveBeenCalledTimes(1);

      // The order is behavior-preserving and load-bearing: collect before fill
      // (atomic per frame), account activity before the fill, and TOTP copy then
      // overlay refresh after it.
      expect(autofillService.collectPageDetailsFromTab$.mock.invocationCallOrder[0]).toBeLessThan(
        accountService.setAccountActivity.mock.invocationCallOrder[0],
      );
      expect(accountService.setAccountActivity.mock.invocationCallOrder[0]).toBeLessThan(
        autofillService.doAutoFillActiveTab.mock.invocationCallOrder[0],
      );
      expect(autofillService.doAutoFillActiveTab.mock.invocationCallOrder[0]).toBeLessThan(
        platformUtilsService.copyToClipboard.mock.invocationCallOrder[0],
      );
      expect(platformUtilsService.copyToClipboard.mock.invocationCallOrder[0]).toBeLessThan(
        updateOverlayCiphers.mock.invocationCallOrder[0],
      );
    });

    it("skips the fill entirely when autofill-on-page-load is disabled", async () => {
      autofillOnPageLoad$.next(false);

      emitPageTransition(pageDetail(1, 0));
      await flushPromises();

      expect(autofillService.collectPageDetailsFromTab$).not.toHaveBeenCalled();
      expect(autofillService.doAutoFillActiveTab).not.toHaveBeenCalled();
      expect(accountService.setAccountActivity).not.toHaveBeenCalled();
    });

    it("does not copy to the clipboard when the fill returns no TOTP", async () => {
      const pd = pageDetail(1, 0);
      autofillService.collectPageDetailsFromTab$.mockReturnValue(of([pd]));
      autofillService.doAutoFillActiveTab.mockResolvedValue(null);

      emitPageTransition(pd);
      await flushPromises();

      expect(platformUtilsService.copyToClipboard).not.toHaveBeenCalled();
      // The overlay refresh is part of the page-load side effects and runs regardless.
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
      autofillService.doAutoFillActiveTab.mockReturnValueOnce(pageLoadFill.promise);

      // A page-load fill starts and blocks in flight.
      emitPageTransition(pd);
      await flushPromises();
      expect(autofillService.doAutoFillActiveTab).toHaveBeenCalledTimes(1);

      // A keyboard fill for the same (tab, frame) queues behind it rather than racing —
      // the two flavors share one serialized entry point.
      autofillOrchestrator.autofillActiveTabFromCommand(pd);
      await flushPromises();
      expect(autofillService.doAutoFillActiveTab).toHaveBeenCalledTimes(1);

      // Once the page-load fill completes, the queued keyboard fill runs.
      pageLoadFill.resolve(null);
      await flushPromises();
      expect(autofillService.doAutoFillActiveTab).toHaveBeenCalledTimes(2);
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
