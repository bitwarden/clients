import { mock, MockProxy } from "jest-mock-extended";
import { Subject, of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { EventCollectionService } from "@bitwarden/common/dirt/event-logs";
import { PhishingDetectionSettingsServiceAbstraction } from "@bitwarden/common/dirt/services/abstractions/phishing-detection-settings.service.abstraction";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessageListener } from "@bitwarden/messaging";

import { BrowserApi } from "../../../platform/browser/browser-api";

import { PhishingDataService } from "./phishing-data.service";
import {
  PHISHING_DETECTION_CANCEL_COMMAND,
  PHISHING_DETECTION_CONTINUE_COMMAND,
  PhishingDetectionService,
} from "./phishing-detection.service";

type TabUpdatedListener = (
  tabId: number,
  changeInfo: chrome.tabs.OnUpdatedInfo,
  tab: chrome.tabs.Tab,
) => void;

function makeTab(url?: string): chrome.tabs.Tab {
  return { url } as chrome.tabs.Tab;
}
// Utility function to wait for all pending promises to resolve
// setTimeout with 0 delay is a common trick to wait
// until the current call stack is clear and all pending promises have a chance to resolve
const flushPromises = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("PhishingDetectionService", () => {
  let logService: LogService;
  let phishingDataService: jest.Mocked<
    Pick<PhishingDataService, "isPhishingWebAddress" | "update$">
  >;
  let phishingDetectionSettingsService: jest.Mocked<PhishingDetectionSettingsServiceAbstraction>;
  let messageSubject: Subject<{ command: string; [key: string]: unknown }>;
  let onEnabled$: Subject<boolean>;
  let tabUpdatedListener: TabUpdatedListener;
  let eventCollectionService: MockProxy<EventCollectionService>;
  let organizationService: MockProxy<OrganizationService>;
  let accountService: MockProxy<AccountService>;

  beforeEach(() => {
    logService = {
      info: jest.fn(),
      debug: jest.fn(),
      warning: jest.fn(),
      error: jest.fn(),
    } as unknown as LogService;

    phishingDataService = {
      isPhishingWebAddress: jest.fn().mockResolvedValue(false),
      update$: of(undefined),
    } as unknown as jest.Mocked<Pick<PhishingDataService, "isPhishingWebAddress" | "update$">>;

    onEnabled$ = new Subject<boolean>();
    phishingDetectionSettingsService = {
      on$: onEnabled$.asObservable(),
    } as unknown as jest.Mocked<PhishingDetectionSettingsServiceAbstraction>;

    messageSubject = new Subject();
    eventCollectionService = mock<EventCollectionService>();
    organizationService = mock<OrganizationService>();
    accountService = mock<AccountService>();

    jest.spyOn(BrowserApi, "addListener").mockImplementation((_event, listener) => {
      tabUpdatedListener = listener as TabUpdatedListener;
    });
    jest.spyOn(BrowserApi, "navigateTabToUrl").mockResolvedValue(undefined);
    jest.spyOn(BrowserApi, "closeTab").mockResolvedValue(undefined);
    jest
      .spyOn(BrowserApi, "getRuntimeURL")
      .mockReturnValue("chrome-extension://abc123/popup/index.html#/security/phishing-warning");
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  function buildService() {
    const listener = new MessageListener(messageSubject.asObservable() as any);
    return new PhishingDetectionService(
      logService,
      phishingDataService as unknown as PhishingDataService,
      phishingDetectionSettingsService,
      listener,
      eventCollectionService,
      organizationService,
      accountService,
    );
  }

  function sendMessage(command: string, payload: Record<string, unknown> = {}) {
    messageSubject.next({ command, ...payload });
  }

  describe("initialization", () => {
    it("registers a chrome.tabs.onUpdated listener via BrowserApi", () => {
      buildService();
      expect(BrowserApi.addListener).toHaveBeenCalledWith(
        chrome.tabs.onUpdated,
        expect.any(Function),
      );
    });
  });

  describe("when phishing detection is disabled", () => {
    beforeEach(() => {
      buildService();
      onEnabled$.next(false);
    });

    it("does not check phishing on tab navigation", async () => {
      tabUpdatedListener(1, { status: "complete" }, makeTab("https://evil.com"));
      await Promise.resolve();
      expect(phishingDataService.isPhishingWebAddress).not.toHaveBeenCalled();
    });

    it("ignores continue commands", async () => {
      sendMessage(PHISHING_DETECTION_CONTINUE_COMMAND.command, {
        tabId: 1,
        url: "https://evil.com",
      });
      await Promise.resolve();
      expect(BrowserApi.navigateTabToUrl).not.toHaveBeenCalled();
    });

    it("ignores cancel commands", async () => {
      sendMessage(PHISHING_DETECTION_CANCEL_COMMAND.command, { tabId: 1 });
      await Promise.resolve();
      expect(BrowserApi.closeTab).not.toHaveBeenCalled();
    });
  });

  describe("tab update filtering", () => {
    beforeEach(() => {
      buildService();
      onEnabled$.next(true);
    });

    it("ignores events where status is not 'complete'", async () => {
      tabUpdatedListener(1, { status: "loading" }, makeTab("https://evil.com"));
      await Promise.resolve();
      expect(phishingDataService.isPhishingWebAddress).not.toHaveBeenCalled();
    });

    it("ignores events where tab.url is undefined", async () => {
      tabUpdatedListener(1, { status: "complete" }, makeTab(undefined));
      await Promise.resolve();
      expect(phishingDataService.isPhishingWebAddress).not.toHaveBeenCalled();
    });

    it.each([
      "chrome-extension://abc/popup.html",
      "moz-extension://abc/popup.html",
      "safari-extension://abc/popup.html",
      "safari-web-extension://abc/popup.html",
    ])("ignores extension page URL: %s", async (url) => {
      tabUpdatedListener(1, { status: "complete" }, makeTab(url));
      await Promise.resolve();
      expect(phishingDataService.isPhishingWebAddress).not.toHaveBeenCalled();
    });

    it("does not re-check the same tab+URL consecutively", async () => {
      const tab = makeTab("https://safe.com");
      tabUpdatedListener(1, { status: "complete" }, tab);
      tabUpdatedListener(1, { status: "complete" }, tab);
      await Promise.resolve();
      expect(phishingDataService.isPhishingWebAddress).toHaveBeenCalledTimes(1);
    });
  });

  describe("phishing detection", () => {
    beforeEach(() => {
      buildService();
      onEnabled$.next(true);
    });

    it("does not redirect if URL is not phishing", async () => {
      phishingDataService.isPhishingWebAddress.mockResolvedValue(false);
      tabUpdatedListener(1, { status: "complete" }, makeTab("https://safe.com"));
      await Promise.resolve();
      expect(BrowserApi.navigateTabToUrl).not.toHaveBeenCalled();
    });

    it("redirects to warning page if URL is phishing", async () => {
      phishingDataService.isPhishingWebAddress.mockResolvedValue(true);
      tabUpdatedListener(1, { status: "complete" }, makeTab("https://evil.com"));
      await flushPromises();
      expect(BrowserApi.navigateTabToUrl).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ href: expect.stringContaining("phishing-warning") }),
      );
    });

    it("includes the phishing URL as a query param in the warning page URL", async () => {
      phishingDataService.isPhishingWebAddress.mockResolvedValue(true);
      tabUpdatedListener(1, { status: "complete" }, makeTab("https://evil.com/path"));
      await flushPromises();
      const redirectUrl: URL = (BrowserApi.navigateTabToUrl as jest.Mock).mock.calls[0][1];
      expect(redirectUrl.href).toContain("?phishingUrl=https://evil.com/path");
    });
  });

  describe("continue command", () => {
    beforeEach(() => {
      buildService();
      onEnabled$.next(true);
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

    it("skips the phishing check on the next navigation to the same host", async () => {
      sendMessage(PHISHING_DETECTION_CONTINUE_COMMAND.command, {
        tabId: 1,
        url: "https://evil.com",
      });
      await flushPromises();

      (BrowserApi.navigateTabToUrl as jest.Mock).mockClear();
      phishingDataService.isPhishingWebAddress.mockResolvedValue(true);

      tabUpdatedListener(1, { status: "complete" }, makeTab("https://evil.com/other-page"));
      await flushPromises();

      // Should not redirect to warning page — was ignored
      expect(BrowserApi.navigateTabToUrl).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ href: expect.stringContaining("phishing-warning") }),
      );
    });

    it("blocks again on the visit after the ignored one", async () => {
      phishingDataService.isPhishingWebAddress.mockResolvedValue(true);

      sendMessage(PHISHING_DETECTION_CONTINUE_COMMAND.command, {
        tabId: 1,
        url: "https://evil.com",
      });
      await flushPromises(); // Wait for all async operations to complete

      // First visit after continue — ignored
      tabUpdatedListener(1, { status: "complete" }, makeTab("https://evil.com/page1"));
      await flushPromises();
      (BrowserApi.navigateTabToUrl as jest.Mock).mockClear();

      // Second visit — should block again
      tabUpdatedListener(2, { status: "complete" }, makeTab("https://evil.com/page2"));
      await flushPromises(); // Wait for all async operations to complete

      expect(BrowserApi.navigateTabToUrl).toHaveBeenCalledWith(
        2,
        expect.objectContaining({ href: expect.stringContaining("phishing-warning") }),
      );
    });
  });

  describe("cancel command", () => {
    beforeEach(() => {
      buildService();
      onEnabled$.next(true);
    });

    it("closes the tab with the given tabId", async () => {
      sendMessage(PHISHING_DETECTION_CANCEL_COMMAND.command, { tabId: 42 });
      await flushPromises(); // Wait for all async operations to complete
      expect(BrowserApi.closeTab).toHaveBeenCalledWith(42);
    });
  });
});
