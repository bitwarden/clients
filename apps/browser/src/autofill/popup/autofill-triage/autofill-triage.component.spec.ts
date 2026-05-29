// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, fakeAsync, TestBed, tick } from "@angular/core/testing";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { mock, MockProxy } from "jest-mock-extended";

import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogService, ToastService } from "@bitwarden/components";

import { BrowserApi } from "../../../platform/browser/browser-api";
import BrowserPopupUtils from "../../../platform/browser/browser-popup-utils";
import { AutofillTriagePageResult } from "../../types/autofill-triage";

import { AutofillTriageComponent } from "./autofill-triage.component";

describe("AutofillTriageComponent", () => {
  let component: AutofillTriageComponent;
  let fixture: ComponentFixture<AutofillTriageComponent>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let toastService: MockProxy<ToastService>;
  let dialogService: MockProxy<DialogService>;

  const mockTab = { id: 42 } as chrome.tabs.Tab;

  const mockTriageResult: AutofillTriagePageResult = {
    pageUrl: "https://example.com/login",
    analyzedAt: new Date("2026-03-26T10:30:00.000Z"),
    targetElementRef: "username",
    tabId: 123,
    extensionVersion: "2024.1.0",
    browserInfo: { name: "Chrome", version: "120.0" },
    fields: [
      {
        htmlId: "username",
        htmlName: "username",
        htmlType: "text",
        placeholder: "Enter username",
        autocomplete: "username",
        eligible: true,
        qualifiedAs: "login",
        conditions: [
          { description: "Is username field", passed: true },
          { description: "Is email field", passed: false },
          { description: "Is current password field", passed: false },
        ],
      },
      {
        htmlId: "password",
        htmlName: "password",
        htmlType: "password",
        eligible: true,
        qualifiedAs: "login",
        conditions: [
          { description: "Is username field", passed: false },
          { description: "Is current password field", passed: true },
        ],
      },
      {
        htmlId: "submit",
        htmlType: "submit",
        eligible: false,
        qualifiedAs: "ineligible",
        conditions: [
          { description: "Is username field", passed: false },
          { description: "Is current password field", passed: false },
        ],
      },
    ],
  };

  beforeEach(async () => {
    platformUtilsService = mock<PlatformUtilsService>();
    toastService = mock<ToastService>();
    dialogService = mock<DialogService>();
    dialogService.openSimpleDialog.mockResolvedValue(true);

    // Mock chrome.runtime with onMessage support
    global.chrome = {
      runtime: {
        sendMessage: jest.fn(),
        onMessage: {
          addListener: jest.fn(),
          removeListener: jest.fn(),
        },
      },
    } as any;

    jest.spyOn(BrowserApi, "getCurrentTab").mockResolvedValue(mockTab);
    jest.spyOn(BrowserApi, "addListener").mockImplementation(() => {});
    jest.spyOn(BrowserApi, "removeListener").mockImplementation(() => {});
    jest.spyOn(BrowserApi, "isSidePanelApiSupported", "get").mockReturnValue(false);
    jest.spyOn(BrowserPopupUtils, "inSidePanel").mockReturnValue(false);

    await TestBed.configureTestingModule({
      imports: [AutofillTriageComponent],
      providers: [
        provideNoopAnimations(),
        { provide: PlatformUtilsService, useValue: platformUtilsService },
        { provide: ToastService, useValue: toastService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(AutofillTriageComponent, {
        set: { template: "" },
      })
      .overrideProvider(DialogService, { useValue: dialogService })
      .compileComponents();

    fixture = TestBed.createComponent(AutofillTriageComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  describe("ngOnInit", () => {
    it("should start in loading state", async () => {
      await component.ngOnInit();

      expect(component.loading()).toBe(true);
    });

    it("should register a message listener via BrowserApi.addListener", async () => {
      await component.ngOnInit();

      expect(BrowserApi.addListener).toHaveBeenCalledWith(
        chrome.runtime.onMessage,
        expect.any(Function),
      );
    });

    it("should send getAutofillTriageResult message to background on init", async () => {
      const sendMessageSpy = jest
        .spyOn(BrowserApi, "sendMessageWithResponse")
        .mockResolvedValue(null);

      await component.ngOnInit();

      expect(sendMessageSpy).toHaveBeenCalledWith("getAutofillTriageResult", { tabId: mockTab.id });
    });

    it("should set triageResult and clear loading when background responds with data", fakeAsync(() => {
      jest.spyOn(BrowserApi, "sendMessageWithResponse").mockResolvedValue(mockTriageResult);

      void component.ngOnInit();
      tick();

      expect(component.triageResult()).toEqual(mockTriageResult);
      expect(component.loading()).toBe(false);
    }));

    it("should exit loading state when background responds with null", fakeAsync(() => {
      jest.spyOn(BrowserApi, "sendMessageWithResponse").mockResolvedValue(null);

      void component.ngOnInit();
      tick();

      expect(component.triageResult()).toBeNull();
      expect(component.loading()).toBe(false);
    }));

    it("should fetch result when triageResultReady message arrives with matching tabId", fakeAsync(() => {
      let capturedListener: (msg: { command: string; tabId?: number }) => void;
      jest.spyOn(BrowserApi, "addListener").mockImplementation((_event, listener) => {
        capturedListener = listener as any;
      });
      jest.spyOn(BrowserApi, "sendMessageWithResponse").mockResolvedValue(mockTriageResult);

      void component.ngOnInit();
      tick();

      // Simulate the push message arriving
      capturedListener({ command: "triageResultReady", tabId: mockTab.id });
      tick();

      expect(component.triageResult()).toEqual(mockTriageResult);
    }));

    it("should ignore triageResultReady message with mismatched tabId", fakeAsync(() => {
      let capturedListener: (msg: { command: string; tabId?: number }) => void;
      jest.spyOn(BrowserApi, "addListener").mockImplementation((_event, listener) => {
        capturedListener = listener as any;
      });
      const sendMessageSpy = jest
        .spyOn(BrowserApi, "sendMessageWithResponse")
        .mockResolvedValue(null);

      void component.ngOnInit();
      tick();

      const callCountAfterInit = sendMessageSpy.mock.calls.length;

      // Message from a different tab should be ignored
      capturedListener({ command: "triageResultReady", tabId: 9999 });
      tick();

      expect(sendMessageSpy).toHaveBeenCalledTimes(callCountAfterInit);
    }));

    it("should clear previous results and expanded fields when new triage is triggered", fakeAsync(() => {
      let capturedListener: (msg: { command: string; tabId?: number }) => void;
      jest.spyOn(BrowserApi, "addListener").mockImplementation((_event, listener) => {
        capturedListener = listener as any;
      });

      const newTriageResult: AutofillTriagePageResult = {
        ...mockTriageResult,
        analyzedAt: new Date("2026-04-02T15:00:00.000Z"),
      };

      jest
        .spyOn(BrowserApi, "sendMessageWithResponse")
        .mockResolvedValueOnce(mockTriageResult)
        .mockResolvedValueOnce(newTriageResult);

      void component.ngOnInit();
      tick();

      // Component should have initial results
      expect(component.triageResult()).toEqual(mockTriageResult);

      // Expand a field
      component.toggleField(0);
      expect(component.isFieldExpanded()(0)).toBe(true);

      // Simulate a new triage being triggered
      capturedListener({ command: "triageResultReady", tabId: mockTab.id });
      tick();

      // Results and expanded fields should be cleared and then refreshed
      expect(component.triageResult()).toEqual(newTriageResult);
      expect(component.isFieldExpanded()(0)).toBe(false);
    }));

    it("should get active tab when in side panel and getCurrentTab returns null", fakeAsync(() => {
      const activeTab = { id: 99 } as chrome.tabs.Tab;
      jest.spyOn(BrowserApi, "getCurrentTab").mockResolvedValue(null);
      jest.spyOn(BrowserPopupUtils, "inSidePanel").mockReturnValue(true);
      jest.spyOn(BrowserApi, "tabsQuery").mockResolvedValue([activeTab]);
      jest.spyOn(BrowserApi, "sendMessageWithResponse").mockResolvedValue(null);

      void component.ngOnInit();
      tick();

      expect(BrowserApi.tabsQuery).toHaveBeenCalledWith({ active: true, currentWindow: true });
      expect(component["currentTabId"]()).toBe(99);
    }));
  });

  describe("ngOnDestroy", () => {
    it("should remove the message listener via BrowserApi.removeListener", async () => {
      await component.ngOnInit();
      component.ngOnDestroy();

      expect(BrowserApi.removeListener).toHaveBeenCalledWith(
        chrome.runtime.onMessage,
        expect.any(Function),
      );
    });

    it("should re-disable the side panel when destroyed in side panel context", async () => {
      jest.spyOn(BrowserPopupUtils, "inSidePanel").mockReturnValue(true);
      jest.spyOn(BrowserApi, "isSidePanelApiSupported", "get").mockReturnValue(true);
      const setSidePanelOptionsSpy = jest
        .spyOn(BrowserApi, "setSidePanelOptions")
        .mockResolvedValue(undefined);

      await component.ngOnInit();
      component.ngOnDestroy();

      expect(setSidePanelOptionsSpy).toHaveBeenCalledWith({ enabled: false, tabId: mockTab.id });
    });

    it("should not disable side panel when destroyed outside side panel context", async () => {
      jest.spyOn(BrowserPopupUtils, "inSidePanel").mockReturnValue(false);
      const setSidePanelOptionsSpy = jest
        .spyOn(BrowserApi, "setSidePanelOptions")
        .mockResolvedValue(undefined);

      await component.ngOnInit();
      component.ngOnDestroy();

      expect(setSidePanelOptionsSpy).not.toHaveBeenCalled();
    });
  });

  describe("eligibleCount", () => {
    it("should return 0 when triageResult is null", () => {
      component.triageResult.set(null);
      expect(component.eligibleCount()).toBe(0);
    });

    it("should return correct count of eligible fields", () => {
      component.triageResult.set(mockTriageResult);
      expect(component.eligibleCount()).toBe(2); // username and password are eligible
    });
  });

  describe("toggleField", () => {
    it("should add field index to expanded set when not present", () => {
      component.toggleField(0);
      expect(component.isFieldExpanded()(0)).toBe(true);
    });

    it("should remove field index from expanded set when present", () => {
      component.toggleField(0);
      component.toggleField(0);
      expect(component.isFieldExpanded()(0)).toBe(false);
    });
  });

  describe("isFieldExpanded", () => {
    it("should return true when field is expanded", () => {
      component.toggleField(1);
      expect(component.isFieldExpanded()(1)).toBe(true);
    });

    it("should return false when field is not expanded", () => {
      component.toggleField(1);
      expect(component.isFieldExpanded()(0)).toBe(false);
    });
  });

  describe("getFieldLabel", () => {
    it("should return htmlId with type when htmlId is present", () => {
      const field = { htmlId: "username", htmlType: "text" };
      expect(component.getFieldLabel(field as any)).toBe("username (text)");
    });

    it("should return htmlName with type when htmlId is not present", () => {
      const field = { htmlName: "user", htmlType: "text" };
      expect(component.getFieldLabel(field as any)).toBe("user (text)");
    });

    it("should return type only when htmlId and htmlName are not present", () => {
      const field = { htmlType: "password" };
      expect(component.getFieldLabel(field as any)).toBe("(password)");
    });

    it("should return '(unnamed field)' when no identifiers are present", () => {
      const field = {};
      expect(component.getFieldLabel(field as any)).toBe("(unnamed field)");
    });

    it("should handle unknown type gracefully", () => {
      const field = { htmlId: "field1" };
      expect(component.getFieldLabel(field as any)).toBe("field1 (unknown type)");
    });
  });

  describe("copyReport", () => {
    it("should not copy when triageResult is null", async () => {
      component.triageResult.set(null);
      await component.copyReport("text");
      expect(platformUtilsService.copyToClipboard).not.toHaveBeenCalled();
    });

    it("should not copy when user cancels the export dialog", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(false);
      component.triageResult.set(mockTriageResult);
      await component.copyReport("text");
      expect(platformUtilsService.copyToClipboard).not.toHaveBeenCalled();
    });

    it("should copy formatted report to clipboard after confirming export dialog", async () => {
      component.triageResult.set(mockTriageResult);
      await component.copyReport("text");

      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
        expect.objectContaining({ type: "warning" }),
      );
      expect(platformUtilsService.copyToClipboard).toHaveBeenCalledWith(expect.any(String));
      const copiedText = platformUtilsService.copyToClipboard.mock.calls[0][0];
      expect(copiedText).toContain("AutoFill Triage Report");
      expect(copiedText).toContain("https://example.com/login");
      expect(copiedText).toContain("username (text)");
    });

    it("should show success toast after copying", async () => {
      component.triageResult.set(mockTriageResult);
      await component.copyReport("text");

      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        title: "Copied to Clipboard",
        message: "Triage report copied to clipboard",
      });
    });
  });

  describe("copyReport (json format)", () => {
    it("should not copy when triageResult is null", async () => {
      component.triageResult.set(null);
      await component.copyReport("json");
      expect(platformUtilsService.copyToClipboard).not.toHaveBeenCalled();
    });

    it("should not copy when user cancels the export dialog", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(false);
      component.triageResult.set(mockTriageResult);
      await component.copyReport("json");
      expect(platformUtilsService.copyToClipboard).not.toHaveBeenCalled();
    });

    it("should copy JSON report to clipboard after confirming export dialog", async () => {
      component.triageResult.set(mockTriageResult);
      await component.copyReport("json");

      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
        expect.objectContaining({ type: "warning" }),
      );
      expect(platformUtilsService.copyToClipboard).toHaveBeenCalledWith(expect.any(String));
      const copiedText = platformUtilsService.copyToClipboard.mock.calls[0][0];
      expect(JSON.parse(copiedText)).toMatchObject({ pageUrl: "https://example.com/login" });
    });

    it("should show success toast after copying", async () => {
      component.triageResult.set(mockTriageResult);
      await component.copyReport("json");

      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        title: "Copied to Clipboard",
        message: "Triage JSON report copied to clipboard",
      });
    });
  });
});
