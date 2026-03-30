import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, fakeAsync, TestBed, tick } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";

import { ApiService } from "@bitwarden/common/abstractions/api.service";

import { AutofillTriagePageResult } from "../../types/autofill-triage";

import { ReportAutofillIssueComponent } from "./report-autofill-issue.component";

describe("ReportAutofillIssueComponent", () => {
  let component: ReportAutofillIssueComponent;
  let fixture: ComponentFixture<ReportAutofillIssueComponent>;
  let apiService: MockProxy<ApiService>;

  const mockTriageResult: AutofillTriagePageResult = {
    pageUrl: "https://example.com/login",
    analyzedAt: "2026-03-26T10:30:00.000Z",
    targetElementRef: "username",
    tabId: 123,
    fields: [
      {
        htmlId: "username",
        htmlType: "text",
        eligible: true,
        qualifiedAs: "login",
        conditions: [],
      },
    ],
  };

  beforeEach(async () => {
    apiService = mock<ApiService>();

    global.chrome = {
      runtime: {
        sendMessage: jest.fn(),
        lastError: undefined,
        getManifest: jest.fn().mockReturnValue({ version: "2025.3.0" }),
      },
    } as any;

    jest.spyOn(window, "close").mockImplementation(() => {});

    await TestBed.configureTestingModule({
      imports: [ReportAutofillIssueComponent],
      providers: [{ provide: ApiService, useValue: apiService }],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(ReportAutofillIssueComponent, {
        set: { template: "" },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ReportAutofillIssueComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  describe("ngOnInit", () => {
    it("sends getAutofillIssueReportResult message to background", async () => {
      await component.ngOnInit();

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        { command: "getAutofillIssueReportResult" },
        expect.any(Function),
      );
    });

    it("sets triageResult and clears isLoading when background responds with data", fakeAsync(() => {
      jest
        .spyOn(chrome.runtime, "sendMessage")
        .mockImplementation((message: any, callback: any) => {
          callback(mockTriageResult);
          return true;
        });

      void component.ngOnInit();
      tick();

      expect(component.triageResult()).toEqual(mockTriageResult);
      expect(component.isLoading()).toBe(false);
    }));

    it("sets errorMessage and clears isLoading when chrome.runtime.lastError is set", fakeAsync(() => {
      jest
        .spyOn(chrome.runtime, "sendMessage")
        .mockImplementation((message: any, callback: any) => {
          Object.defineProperty(chrome.runtime, "lastError", {
            get: () => ({ message: "Extension context invalidated" }),
            configurable: true,
          });
          callback(null);
          Object.defineProperty(chrome.runtime, "lastError", {
            get: () => undefined,
            configurable: true,
          });
          return true;
        });

      void component.ngOnInit();
      tick();

      expect(component.triageResult()).toBeNull();
      expect(component.errorMessage()).toBe("autofillReportLoadError");
      expect(component.isLoading()).toBe(false);
    }));

    it("does not set triageResult when lastError is set", fakeAsync(() => {
      jest
        .spyOn(chrome.runtime, "sendMessage")
        .mockImplementation((message: any, callback: any) => {
          Object.defineProperty(chrome.runtime, "lastError", {
            get: () => ({ message: "Error" }),
            configurable: true,
          });
          callback(mockTriageResult);
          Object.defineProperty(chrome.runtime, "lastError", {
            get: () => undefined,
            configurable: true,
          });
          return true;
        });

      void component.ngOnInit();
      tick();

      expect(component.triageResult()).toBeNull();
    }));

    it("starts with isLoading true", () => {
      expect(component.isLoading()).toBe(true);
    });
  });

  describe("toggleDetail", () => {
    it("toggles showDetail from false to true", () => {
      expect(component.showDetail()).toBe(false);
      component.toggleDetail();
      expect(component.showDetail()).toBe(true);
    });

    it("toggles showDetail from true to false", () => {
      component.showDetail.set(true);
      component.toggleDetail();
      expect(component.showDetail()).toBe(false);
    });
  });

  describe("onUserMessageInput", () => {
    it("updates userMessage from input event", () => {
      const event = { target: { value: "This is my message" } } as any;
      component.onUserMessageInput(event);
      expect(component.userMessage()).toBe("This is my message");
    });
  });

  describe("sendReport", () => {
    it("returns early when triageResult is null", async () => {
      component.triageResult.set(null);
      await component.sendReport();
      expect(apiService.postAutofillTriageReport).not.toHaveBeenCalled();
    });

    it("sets autofillReportTooLarge error when report data exceeds max bytes", async () => {
      const largeFields = Array.from({ length: 1000 }, (_, i) => ({
        htmlId: `field-${i}`,
        htmlType: "text",
        eligible: true,
        qualifiedAs: "login",
        conditions: Array.from({ length: 50 }, (__, j) => ({
          description: `Condition ${j} with a long description to pad the size`,
          passed: true,
        })),
      }));
      component.triageResult.set({ ...mockTriageResult, fields: largeFields as any });

      await component.sendReport();

      expect(component.errorMessage()).toBe("autofillReportTooLarge");
      expect(apiService.postAutofillTriageReport).not.toHaveBeenCalled();
    });

    it("calls postAutofillTriageReport with the correct data", async () => {
      component.triageResult.set(mockTriageResult);
      component.userMessage.set("my message");
      apiService.postAutofillTriageReport.mockResolvedValue(undefined);

      await component.sendReport();

      expect(apiService.postAutofillTriageReport).toHaveBeenCalledWith(
        expect.objectContaining({
          pageUrl: mockTriageResult.pageUrl,
          userMessage: "my message",
          targetElementRef: mockTriageResult.targetElementRef,
          extensionVersion: "2025.3.0",
        }),
      );
    });

    it("sets isSuccess and closes window after successful send", fakeAsync(() => {
      component.triageResult.set(mockTriageResult);
      apiService.postAutofillTriageReport.mockResolvedValue(undefined);

      void component.sendReport();
      tick(2000);

      expect(component.isSuccess()).toBe(true);
      expect(window.close).toHaveBeenCalled();
    }));

    it("sets autofillReportError on API failure", async () => {
      component.triageResult.set(mockTriageResult);
      apiService.postAutofillTriageReport.mockRejectedValue(new Error("Network error"));

      await component.sendReport();

      expect(component.errorMessage()).toBe("autofillReportError");
      expect(component.isSuccess()).toBe(false);
    });

    it("resets isSending after send completes regardless of outcome", async () => {
      component.triageResult.set(mockTriageResult);
      apiService.postAutofillTriageReport.mockRejectedValue(new Error("fail"));

      await component.sendReport();

      expect(component.isSending()).toBe(false);
    });

    it("clears previous errorMessage before sending", async () => {
      component.triageResult.set(mockTriageResult);
      component.errorMessage.set("autofillReportTooLarge");
      apiService.postAutofillTriageReport.mockResolvedValue(undefined);

      await component.sendReport();

      expect(component.errorMessage()).toBeNull();
    });
  });

  describe("cancel", () => {
    it("closes the window", () => {
      component.cancel();
      expect(window.close).toHaveBeenCalled();
    });
  });
});
