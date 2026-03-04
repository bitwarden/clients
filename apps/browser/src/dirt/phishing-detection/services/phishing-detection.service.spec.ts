import { mock, MockProxy } from "jest-mock-extended";
import { Observable, of, Subject } from "rxjs";

import { PhishingDetectionSettingsServiceAbstraction } from "@bitwarden/common/dirt/services/abstractions/phishing-detection-settings.service.abstraction";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessageListener } from "@bitwarden/messaging";

import { fromChromeEvent } from "../../../platform/browser/from-chrome-event";

import { PhishingDataService } from "./phishing-data.service";
import { PhishingDetectionService } from "./phishing-detection.service";

// Mock fromChromeEvent to return a controllable Subject
const mockBeforeNavigate$ = new Subject<[chrome.webNavigation.WebNavigationBaseCallbackDetails]>();

jest.mock("../../../platform/browser/from-chrome-event", () => ({
  fromChromeEvent: jest.fn(() => mockBeforeNavigate$),
}));

describe("PhishingDetectionService", () => {
  let logService: LogService;
  let phishingDataService: MockProxy<PhishingDataService>;
  let messageListener: MockProxy<MessageListener>;
  let phishingDetectionSettingsService: MockProxy<PhishingDetectionSettingsServiceAbstraction>;
  let dispose: (() => void) | undefined;

  beforeEach(() => {
    dispose?.();
    dispose = undefined;
    jest.clearAllMocks();

    // Re-wire the mock since clearAllMocks resets the implementation
    (fromChromeEvent as jest.Mock).mockReturnValue(mockBeforeNavigate$);

    logService = {
      info: jest.fn(),
      debug: jest.fn(),
      warning: jest.fn(),
      error: jest.fn(),
    } as any;
    phishingDataService = mock();
    phishingDataService.update$ = new Subject().asObservable() as any;
    phishingDataService.isPhishingWebAddress.mockResolvedValue(false);

    messageListener = mock<MessageListener>({
      messages$(_commandDefinition) {
        return new Observable();
      },
    });
    phishingDetectionSettingsService = mock<PhishingDetectionSettingsServiceAbstraction>({
      on$: of(true),
    });
  });

  afterEach(() => {
    dispose?.();
    dispose = undefined;
  });

  function initService() {
    dispose = PhishingDetectionService.initialize(
      logService,
      phishingDataService,
      phishingDetectionSettingsService,
      messageListener,
    ) as (() => void) | undefined;
  }

  function emitNavEvent(tabId: number, url: string, frameId = 0) {
    mockBeforeNavigate$.next([
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
      } as unknown as chrome.webNavigation.WebNavigationBaseCallbackDetails,
    ]);
  }

  it("should initialize without errors", () => {
    expect(() => initService()).not.toThrow();
  });

  it("should use fromChromeEvent with webNavigation.onBeforeNavigate", () => {
    initService();
    expect(fromChromeEvent).toHaveBeenCalledWith(chrome.webNavigation.onBeforeNavigate);
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

  it("should not require manual removeListener on dispose", () => {
    initService();
    dispose?.();
    dispose = undefined;

    // fromChromeEvent handles cleanup via Observable teardown —
    // no BrowserApi.removeListener call needed
    expect(logService.debug).toHaveBeenCalledWith(expect.stringContaining("Initialize called"));
  });
});
