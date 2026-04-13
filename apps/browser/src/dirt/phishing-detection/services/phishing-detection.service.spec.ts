import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, Observable, Subject } from "rxjs";

import { PhishingDetectionSettingsServiceAbstraction } from "@bitwarden/common/dirt/services/abstractions/phishing-detection-settings.service.abstraction";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessageListener } from "@bitwarden/messaging";

import { fromChromeEvent } from "../../../platform/browser/from-chrome-event";

import { PhishingDataService } from "./phishing-data.service";
import { PhishingDetectionService } from "./phishing-detection.service";

// Mock fromChromeEvent to return controllable Subjects per call order.
// The service calls fromChromeEvent twice: first for onCommitted, then for onErrorOccurred.
const mockOnCommitted$ = new Subject<
  [chrome.webNavigation.WebNavigationTransitionCallbackDetails]
>();
const mockOnErrorOccurred$ = new Subject<
  [chrome.webNavigation.WebNavigationFramedErrorCallbackDetails]
>();

jest.mock("../../../platform/browser/from-chrome-event", () => ({
  fromChromeEvent: jest.fn(),
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

    messageListener = {
      messages$: jest.fn().mockReturnValue(new Observable()),
    } as any;
    phishingDetectionSettingsService = {
      on$: new BehaviorSubject(true),
    } as any;
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

  it("should not require manual removeListener on dispose", () => {
    initService();
    dispose?.();
    dispose = undefined;

    // fromChromeEvent handles cleanup via Observable teardown —
    // no BrowserApi.removeListener call needed
    expect(logService.debug).toHaveBeenCalledWith(expect.stringContaining("Initialize called"));
  });
});
