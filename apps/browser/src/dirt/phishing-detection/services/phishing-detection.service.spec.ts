import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom, Observable, of, skip, Subject } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { FakeGlobalStateProvider } from "@bitwarden/common/spec";
import { MessageListener } from "@bitwarden/messaging";

import { BrowserApi } from "../../../platform/browser/browser-api";

import { PhishingDataService } from "./phishing-data.service";
import {
  IGNORED_PHISHING_HOSTNAMES_KEY,
  PHISHING_DETECTION_CANCEL_COMMAND,
  PHISHING_DETECTION_CONTINUE_COMMAND,
  PhishingDetectionService,
} from "./phishing-detection.service";

jest.mock("../../../platform/browser/browser-api");

describe("PhishingDetectionService", () => {
  let accountService: AccountService;
  let billingAccountProfileStateService: BillingAccountProfileStateService;
  let configService: ConfigService;
  let logService: LogService;
  let phishingDataService: MockProxy<PhishingDataService>;
  let messageListener: MockProxy<MessageListener>;
  let globalStateProvider: FakeGlobalStateProvider;
  let continueCommandSubject: Subject<{ tabId: number; url: string }>;
  let cancelCommandSubject: Subject<{ tabId: number }>;

  let cleanupFn: (() => void) | undefined;

  beforeEach(() => {
    // Mock a premium account with access to phishing detection
    const mockAccount = { id: "test-user-id" };
    accountService = {
      getAccount$: jest.fn(() => of(mockAccount)),
      activeAccount$: of(mockAccount),
    } as any;
    billingAccountProfileStateService = {
      hasPremiumFromAnySource$: jest.fn(() => of(true)),
    } as any;
    configService = { getFeatureFlag$: jest.fn(() => of(true)) } as any;
    logService = { info: jest.fn(), debug: jest.fn(), warning: jest.fn(), error: jest.fn() } as any;
    phishingDataService = mock();
    phishingDataService.update$ = of(undefined);

    continueCommandSubject = new Subject();
    cancelCommandSubject = new Subject();

    messageListener = mock<MessageListener>();
    messageListener.messages$.mockImplementation((commandDefinition: any) => {
      if (commandDefinition === PHISHING_DETECTION_CONTINUE_COMMAND) {
        return continueCommandSubject.asObservable();
      } else if (commandDefinition === PHISHING_DETECTION_CANCEL_COMMAND) {
        return cancelCommandSubject.asObservable();
      }
      return new Observable();
    });

    globalStateProvider = new FakeGlobalStateProvider();

    jest.spyOn(BrowserApi, "addListener").mockImplementation(() => {});
    jest.spyOn(BrowserApi, "removeListener").mockImplementation(() => {});
    jest.spyOn(BrowserApi, "navigateTabToUrl").mockResolvedValue(undefined);
    jest.spyOn(BrowserApi, "closeTab").mockResolvedValue(undefined);
    jest.spyOn(BrowserApi, "getRuntimeURL").mockReturnValue("chrome-extension://test/");
  });

  afterEach(() => {
    if (cleanupFn) {
      cleanupFn();
      cleanupFn = undefined;
    }
    (PhishingDetectionService as any)._didInit = false;
  });

  it("should initialize without errors", () => {
    expect(() => {
      cleanupFn = PhishingDetectionService.initialize(
        accountService,
        billingAccountProfileStateService,
        configService,
        logService,
        phishingDataService,
        messageListener,
        globalStateProvider,
      );
    }).not.toThrow();
  });

  describe("Persistent Storage", () => {
    it("loads ignored hostnames from storage on initialization", async () => {
      const state = globalStateProvider.get(IGNORED_PHISHING_HOSTNAMES_KEY);
      await state.update(() => ["malicious.com", "phishing.net"]);

      cleanupFn = PhishingDetectionService.initialize(
        accountService,
        billingAccountProfileStateService,
        configService,
        logService,
        phishingDataService,
        messageListener,
        globalStateProvider,
      );

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(logService.debug).toHaveBeenCalledWith(
        expect.stringContaining("Loaded/updated 2 ignored hostnames"),
      );
    });

    it("persists ignored hostname when user continues to phishing site", async () => {
      const state = globalStateProvider.get(IGNORED_PHISHING_HOSTNAMES_KEY);

      cleanupFn = PhishingDetectionService.initialize(
        accountService,
        billingAccountProfileStateService,
        configService,
        logService,
        phishingDataService,
        messageListener,
        globalStateProvider,
      );

      await new Promise((resolve) => setTimeout(resolve, 0));

      const stateUpdatePromise = firstValueFrom(state.state$.pipe(skip(1)));

      continueCommandSubject.next({
        tabId: 123,
        url: "https://malicious.com/login",
      });

      const storedHostnames = await stateUpdatePromise;
      expect(storedHostnames).toContain("malicious.com");
    });

    it("handles multiple ignored hostnames", async () => {
      const state = globalStateProvider.get(IGNORED_PHISHING_HOSTNAMES_KEY);

      cleanupFn = PhishingDetectionService.initialize(
        accountService,
        billingAccountProfileStateService,
        configService,
        logService,
        phishingDataService,
        messageListener,
        globalStateProvider,
      );

      await new Promise((resolve) => setTimeout(resolve, 0));

      const firstUpdatePromise = firstValueFrom(state.state$.pipe(skip(1)));
      continueCommandSubject.next({
        tabId: 123,
        url: "https://malicious1.com/page",
      });
      await firstUpdatePromise;

      const secondUpdatePromise = firstValueFrom(state.state$.pipe(skip(1)));
      continueCommandSubject.next({
        tabId: 124,
        url: "https://malicious2.com/page",
      });
      const storedHostnames = await secondUpdatePromise;

      expect(storedHostnames).toContain("malicious1.com");
      expect(storedHostnames).toContain("malicious2.com");
      expect((storedHostnames as string[]).length).toBe(2);
    });

    it("does not duplicate hostnames when same site is ignored multiple times", async () => {
      const state = globalStateProvider.get(IGNORED_PHISHING_HOSTNAMES_KEY);

      cleanupFn = PhishingDetectionService.initialize(
        accountService,
        billingAccountProfileStateService,
        configService,
        logService,
        phishingDataService,
        messageListener,
        globalStateProvider,
      );

      await new Promise((resolve) => setTimeout(resolve, 0));

      const firstUpdatePromise = firstValueFrom(state.state$.pipe(skip(1)));
      continueCommandSubject.next({
        tabId: 123,
        url: "https://malicious.com/page1",
      });
      await firstUpdatePromise;

      const secondUpdatePromise = firstValueFrom(state.state$.pipe(skip(1)));
      continueCommandSubject.next({
        tabId: 124,
        url: "https://malicious.com/page2",
      });
      const storedHostnames = await secondUpdatePromise;

      const hostnameArray = storedHostnames as string[];
      const count = hostnameArray.filter((h) => h === "malicious.com").length;
      expect(count).toBe(1);
      expect(hostnameArray.length).toBe(1);
    });

    it("handles storage initialization with empty state", async () => {
      const state = globalStateProvider.get(IGNORED_PHISHING_HOSTNAMES_KEY);

      expect(() => {
        cleanupFn = PhishingDetectionService.initialize(
          accountService,
          billingAccountProfileStateService,
          configService,
          logService,
          phishingDataService,
          messageListener,
          globalStateProvider,
        );
      }).not.toThrow();

      await new Promise((resolve) => setTimeout(resolve, 0));

      const stateUpdatePromise = firstValueFrom(state.state$.pipe(skip(1)));
      continueCommandSubject.next({
        tabId: 123,
        url: "https://test.com/page",
      });

      const storedHostnames = await stateUpdatePromise;
      expect(storedHostnames).toContain("test.com");
    });

    it("syncs state updates from other contexts", async () => {
      const state = globalStateProvider.get(IGNORED_PHISHING_HOSTNAMES_KEY);

      cleanupFn = PhishingDetectionService.initialize(
        accountService,
        billingAccountProfileStateService,
        configService,
        logService,
        phishingDataService,
        messageListener,
        globalStateProvider,
      );

      await new Promise((resolve) => setTimeout(resolve, 0));

      await state.update(() => ["external.com", "updated.com"]);

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(logService.debug).toHaveBeenCalledWith(
        expect.stringContaining("Loaded/updated 2 ignored hostnames"),
      );
    });
  });

  // TODO
  // it("should enable phishing detection for premium account", (done) => {
  //   const premiumAccount = { id: "user1" };
  //   accountService = { activeAccount$: of(premiumAccount) } as any;
  //   configService = { getFeatureFlag$: jest.fn(() => of(true)) } as any;
  //   billingAccountProfileStateService = {
  //     hasPremiumFromAnySource$: jest.fn(() => of(true)),
  //   } as any;

  //   // Run the initialization
  //   PhishingDetectionService.initialize(
  //     accountService,
  //     billingAccountProfileStateService,
  //     configService,
  //     logService,
  //     phishingDataService,
  //     messageListener,
  //   );
  // });

  // TODO
  // it("should not enable phishing detection for non-premium account", (done) => {
  //   const nonPremiumAccount = { id: "user2" };
  //   accountService = { activeAccount$: of(nonPremiumAccount) } as any;
  //   configService = { getFeatureFlag$: jest.fn(() => of(true)) } as any;
  //   billingAccountProfileStateService = {
  //     hasPremiumFromAnySource$: jest.fn(() => of(false)),
  //   } as any;

  //   // Run the initialization
  //   PhishingDetectionService.initialize(
  //     accountService,
  //     billingAccountProfileStateService,
  //     configService,
  //     logService,
  //     phishingDataService,
  //     messageListener,
  //   );
  // });
});
