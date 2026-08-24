import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, Subject } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { EventCollectionService } from "@bitwarden/common/dirt/event-logs";
import { PhishingDetectionSettingsServiceAbstraction } from "@bitwarden/common/dirt/services/abstractions/phishing-detection-settings.service.abstraction";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessageListener } from "@bitwarden/messaging";

import { BrowserApi } from "../../../platform/browser/browser-api";
import { fromChromeEvent } from "../../../platform/browser/from-chrome-event";

import { PhishingDataService } from "./phishing-data.service";
import {
  PHISHING_DETECTION_CANCEL_COMMAND,
  PHISHING_DETECTION_CONTINUE_COMMAND,
  PhishingDetectionService,
} from "./phishing-detection.service";

jest.mock("../../../platform/browser/from-chrome-event", () => ({
  fromChromeEvent: jest.fn(),
}));

const flushPromises = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("PhishingDetectionService", () => {
  let logService: LogService;
  let phishingDataService: MockProxy<PhishingDataService>;
  let phishingDetectionSettingsService: MockProxy<PhishingDetectionSettingsServiceAbstraction>;
  let eventCollectionService: MockProxy<EventCollectionService>;
  let organizationService: MockProxy<OrganizationService>;
  let accountService: MockProxy<AccountService>;
  let messageSubject: Subject<any>;
  let onEnabled$: BehaviorSubject<boolean>;
  // Fresh Subjects per test to prevent stale subscriptions from previous tests
  let mockOnCommitted$: Subject<[chrome.webNavigation.WebNavigationTransitionCallbackDetails]>;
  let mockOnErrorOccurred$: Subject<[chrome.webNavigation.WebNavigationFramedErrorCallbackDetails]>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockOnCommitted$ = new Subject();
    mockOnErrorOccurred$ = new Subject();

    // Re-wire the mock since clearAllMocks resets the implementation.
    // Call order: 1st = onCommitted, 2nd = onErrorOccurred (matches service code)
    (fromChromeEvent as jest.Mock)
      .mockReturnValueOnce(mockOnCommitted$)
      .mockReturnValueOnce(mockOnErrorOccurred$);

    logService = {
      info: jest.fn(),
      debug: jest.fn(),
      warning: jest.fn(),
      error: jest.fn(),
    } as any;
    phishingDataService = mock();
    phishingDataService.update$ = new Subject().asObservable() as any;
    phishingDataService.isPhishingWebAddress.mockResolvedValue(false);

    messageSubject = new Subject();
    onEnabled$ = new BehaviorSubject(true);
    phishingDetectionSettingsService = {
      on$: onEnabled$,
    } as any;
    eventCollectionService = mock<EventCollectionService>();
    organizationService = mock<OrganizationService>();
    accountService = mock<AccountService>();

    jest.spyOn(BrowserApi, "navigateTabToUrl").mockResolvedValue(undefined);
    jest.spyOn(BrowserApi, "closeTab").mockResolvedValue(undefined);
    jest
      .spyOn(BrowserApi, "getRuntimeURL")
      .mockReturnValue("chrome-extension://abc123/popup/index.html#/security/phishing-warning");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function initService() {
    const listener = new MessageListener(messageSubject.asObservable() as any);
    return new PhishingDetectionService(
      logService,
      phishingDataService,
      phishingDetectionSettingsService,
      listener,
      eventCollectionService,
      organizationService,
      accountService,
    );
  }

  function emitNavEvent(tabId: number, url: string, frameId = 0) {
    mockOnCommitted$.next([
      {
        tabId,
        url,
        frameId,
        timeStamp: Date.now(),
        parentFrameId: -1,
        processId: 1,
        parentDocumentId: "",
        documentId: "",
        documentLifecycle: "active",
        transitionType: "link",
        transitionQualifiers: [],
      } as unknown as chrome.webNavigation.WebNavigationTransitionCallbackDetails,
    ]);
  }

  function emitErrorEvent(tabId: number, url: string, error: string, frameId = 0) {
    mockOnErrorOccurred$.next([
      {
        tabId,
        url,
        frameId,
        timeStamp: Date.now(),
        parentFrameId: -1,
        processId: 1,
        parentDocumentId: "",
        documentId: "",
        documentLifecycle: "active",
        error,
      } as unknown as chrome.webNavigation.WebNavigationFramedErrorCallbackDetails,
    ]);
  }

  function sendMessage(command: string, payload: Record<string, unknown> = {}) {
    messageSubject.next({ command, ...payload });
  }

  it("should initialize without errors", () => {
    expect(() => initService()).not.toThrow();
  });

  it("should subscribe to both onCommitted and onErrorOccurred", () => {
    initService();
    expect(fromChromeEvent).toHaveBeenCalledTimes(2);
  });

  it("should filter out iframe navigations (frameId !== 0)", () => {
    initService();

    emitNavEvent(1, "https://phishing-site.example.com", 1);
    emitNavEvent(1, "https://phishing-site.example.com", 2);

    expect(phishingDataService.isPhishingWebAddress).not.toHaveBeenCalled();
  });

  it("should filter out extension page URLs", () => {
    initService();

    emitNavEvent(1, "chrome-extension://fake-id/popup/index.html", 0);
    emitNavEvent(1, "moz-extension://fake-id/popup/index.html", 0);

    expect(phishingDataService.isPhishingWebAddress).not.toHaveBeenCalled();
  });

  it("should check phishing via onErrorOccurred when onCommitted does not fire", () => {
    initService();

    // Chrome fires onErrorOccurred (not onCommitted) for HTTP errors like 4xx/5xx
    emitErrorEvent(1, "http://akonaa.fr/", "net::ERR_HTTP_RESPONSE_CODE_FAILURE");

    expect(phishingDataService.isPhishingWebAddress).toHaveBeenCalledWith(
      expect.objectContaining({ hostname: "akonaa.fr" }),
    );
  });

  it("should filter out iframe navigations from onErrorOccurred", () => {
    initService();

    emitErrorEvent(1, "http://akonaa.fr/", "net::ERR_HTTP_RESPONSE_CODE_FAILURE", 1);

    expect(phishingDataService.isPhishingWebAddress).not.toHaveBeenCalled();
  });

  describe("when phishing detection is disabled", () => {
    beforeEach(() => {
      initService();
      onEnabled$.next(false);
    });

    it("does not check phishing on tab navigation", async () => {
      emitNavEvent(1, "https://evil.com");
      await flushPromises();
      expect(phishingDataService.isPhishingWebAddress).not.toHaveBeenCalled();
    });

    it("ignores continue commands", async () => {
      sendMessage(PHISHING_DETECTION_CONTINUE_COMMAND.command, {
        tabId: 1,
        url: "https://evil.com",
      });
      await flushPromises();
      expect(BrowserApi.navigateTabToUrl).not.toHaveBeenCalled();
    });

    it("ignores cancel commands", async () => {
      sendMessage(PHISHING_DETECTION_CANCEL_COMMAND.command, { tabId: 1 });
      await flushPromises();
      expect(BrowserApi.closeTab).not.toHaveBeenCalled();
    });
  });

  describe("phishing detection", () => {
    beforeEach(() => {
      initService();
    });

    it("does not redirect if URL is not phishing", async () => {
      phishingDataService.isPhishingWebAddress.mockResolvedValue(false);
      emitNavEvent(1, "https://safe.com");
      await flushPromises();
      expect(BrowserApi.navigateTabToUrl).not.toHaveBeenCalled();
    });

    it("redirects to warning page if URL is phishing", async () => {
      phishingDataService.isPhishingWebAddress.mockResolvedValue(true);
      emitNavEvent(1, "https://evil.com");
      await flushPromises();
      expect(BrowserApi.navigateTabToUrl).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ href: expect.stringContaining("phishing-warning") }),
      );
    });

    it("includes the phishing URL as a query param in the warning page URL", async () => {
      phishingDataService.isPhishingWebAddress.mockResolvedValue(true);
      emitNavEvent(1, "https://evil.com/path");
      await flushPromises();
      const redirectUrl: URL = (BrowserApi.navigateTabToUrl as jest.Mock).mock.calls[0][1];
      expect(redirectUrl.href).toContain("?phishingUrl=https://evil.com/path");
    });
  });

  describe("continue command", () => {
    beforeEach(() => {
      initService();
    });

    it("navigates to the continued URL", async () => {
      sendMessage(PHISHING_DETECTION_CONTINUE_COMMAND.command, {
        tabId: 1,
        url: "https://evil.com",
      });
      await flushPromises();
      expect(BrowserApi.navigateTabToUrl).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ hostname: "evil.com" }),
      );
    });

    it("skips phishing check on next navigation to same host and tab", async () => {
      sendMessage(PHISHING_DETECTION_CONTINUE_COMMAND.command, {
        tabId: 1,
        url: "https://evil.com",
      });
      await flushPromises();

      (BrowserApi.navigateTabToUrl as jest.Mock).mockClear();
      phishingDataService.isPhishingWebAddress.mockResolvedValue(true);

      emitNavEvent(1, "https://evil.com/other-page");
      await flushPromises();

      // Should not redirect to warning page -- was ignored for this tab
      expect(BrowserApi.navigateTabToUrl).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ href: expect.stringContaining("phishing-warning") }),
      );
    });
  });

  describe("cancel command", () => {
    beforeEach(() => {
      initService();
    });

    it("closes the tab with the given tabId", async () => {
      sendMessage(PHISHING_DETECTION_CANCEL_COMMAND.command, { tabId: 42 });
      await flushPromises();
      expect(BrowserApi.closeTab).toHaveBeenCalledWith(42);
    });
  });

  describe("dedup", () => {
    it("does not re-check the same tab+URL consecutively", async () => {
      initService();

      emitNavEvent(1, "https://safe.com");
      emitNavEvent(1, "https://safe.com");
      await flushPromises();

      expect(phishingDataService.isPhishingWebAddress).toHaveBeenCalledTimes(1);
    });
  });

  describe("per-tab isolation", () => {
    it("continue on tab 1 does not bypass phishing check on tab 2", async () => {
      initService();
      phishingDataService.isPhishingWebAddress.mockResolvedValue(true);

      // Continue on tab 1
      sendMessage(PHISHING_DETECTION_CONTINUE_COMMAND.command, {
        tabId: 1,
        url: "https://evil.com",
      });
      await flushPromises();
      (BrowserApi.navigateTabToUrl as jest.Mock).mockClear();

      // Tab 2 navigates to same hostname -- should still be blocked
      emitNavEvent(2, "https://evil.com/page");
      await flushPromises();

      expect(BrowserApi.navigateTabToUrl).toHaveBeenCalledWith(
        2,
        expect.objectContaining({ href: expect.stringContaining("phishing-warning") }),
      );
    });
  });
});
