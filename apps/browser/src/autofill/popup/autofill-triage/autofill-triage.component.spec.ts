// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, fakeAsync, TestBed, tick } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ToastService } from "@bitwarden/components";

import { AutofillTriagePageResult } from "../../types/autofill-triage";

import { AutofillTriageComponent } from "./autofill-triage.component";

describe("AutofillTriageComponent", () => {
  let component: AutofillTriageComponent;
  let fixture: ComponentFixture<AutofillTriageComponent>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let i18nService: MockProxy<I18nService>;
  let toastService: MockProxy<ToastService>;

  const mockTriageResult: AutofillTriagePageResult = {
    tabId: 123,
    pageUrl: "https://example.com/login",
    analyzedAt: "2026-03-26T10:30:00.000Z",
    targetElementRef: "username",
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
    i18nService = mock<I18nService>();
    toastService = mock<ToastService>();

    i18nService.t.mockImplementation((key: string) => key);

    // Mock chrome.runtime.sendMessage
    global.chrome = {
      runtime: {
        sendMessage: jest.fn(),
      },
    } as any;

    await TestBed.configureTestingModule({
      imports: [AutofillTriageComponent],
      providers: [
        { provide: PlatformUtilsService, useValue: platformUtilsService },
        { provide: I18nService, useValue: i18nService },
        { provide: ToastService, useValue: toastService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(AutofillTriageComponent, {
        set: { template: "" },
      })
      .compileComponents();

    fixture = TestBed.createComponent(AutofillTriageComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  describe("ngOnInit", () => {
    it("should send getAutofillTriageResult message to background", async () => {
      const sendMessageSpy = jest.spyOn(chrome.runtime, "sendMessage");

      await component.ngOnInit();

      expect(sendMessageSpy).toHaveBeenCalledWith(
        { command: "getAutofillTriageResult" },
        expect.any(Function),
      );
    });

    it("should set triageResult when background responds with data", fakeAsync(() => {
      jest
        .spyOn(chrome.runtime, "sendMessage")
        .mockImplementation((message: any, callback: any) => {
          callback(mockTriageResult);
          return true;
        });

      void component.ngOnInit();
      tick();

      expect(component.triageResult()).toEqual(mockTriageResult);
    }));

    it("should set triageResult to null when background responds with null", fakeAsync(() => {
      jest
        .spyOn(chrome.runtime, "sendMessage")
        .mockImplementation((message: any, callback: any) => {
          callback(null);
          return true;
        });

      void component.ngOnInit();
      tick();

      expect(component.triageResult()).toBeNull();
    }));
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
    it("should add field index to expandedFields when not present", () => {
      component.toggleField(0);
      expect(component.expandedFields().has(0)).toBe(true);
    });

    it("should remove field index from expandedFields when present", () => {
      component.expandedFields.set(new Set([0]));
      component.toggleField(0);
      expect(component.expandedFields().has(0)).toBe(false);
    });
  });

  describe("isFieldExpanded", () => {
    it("should return true when field is expanded", () => {
      component.expandedFields.set(new Set([1]));
      expect(component.isFieldExpanded(1)).toBe(true);
    });

    it("should return false when field is not expanded", () => {
      component.expandedFields.set(new Set([1]));
      expect(component.isFieldExpanded(0)).toBe(false);
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

    it("should return '(unnamed)' when no identifiers are present", () => {
      const field = {};
      expect(component.getFieldLabel(field as any)).toBe("(unnamed)");
    });

    it("should handle unknown type gracefully", () => {
      const field = { htmlId: "field1" };
      expect(component.getFieldLabel(field as any)).toBe("field1 (unknown)");
    });
  });

  describe("copyReport", () => {
    it("should not copy when triageResult is null", async () => {
      component.triageResult.set(null);
      await component.copyReport();
      expect(platformUtilsService.copyToClipboard).not.toHaveBeenCalled();
    });

    it("should copy formatted report to clipboard", async () => {
      component.triageResult.set(mockTriageResult);
      await component.copyReport();

      expect(platformUtilsService.copyToClipboard).toHaveBeenCalledWith(expect.any(String));
      const copiedText = platformUtilsService.copyToClipboard.mock.calls[0][0];
      expect(copiedText).toContain("AutoFill Triage Report");
      expect(copiedText).toContain("https://example.com/login");
      expect(copiedText).toContain("username (text)");
    });

    it("should show success toast after copying", async () => {
      component.triageResult.set(mockTriageResult);
      await component.copyReport();

      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        title: "copiedToClipboard",
        message: "triageReportCopied",
      });
    });
  });

  describe("getFieldBadgeVariant", () => {
    it("should return 'success' for eligible fields", () => {
      expect(component.getFieldBadgeVariant(true)).toBe("success");
    });

    it("should return 'secondary' for ineligible fields", () => {
      expect(component.getFieldBadgeVariant(false)).toBe("secondary");
    });
  });

  describe("getFieldStatusIcon", () => {
    it("should return ✅ for eligible fields", () => {
      expect(component.getFieldStatusIcon(true)).toBe("✅");
    });

    it("should return ❌ for ineligible fields", () => {
      expect(component.getFieldStatusIcon(false)).toBe("❌");
    });
  });

  describe("getConditionIcon", () => {
    it("should return ✅ for passed conditions", () => {
      expect(component.getConditionIcon(true)).toBe("✅");
    });

    it("should return ❌ for failed conditions", () => {
      expect(component.getConditionIcon(false)).toBe("❌");
    });
  });
});
