import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ReactiveFormsModule } from "@angular/forms";
import { By } from "@angular/platform-browser";

import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ToastService } from "@bitwarden/components";

import { PamApiService } from "../../abstractions/pam-api.service";
import {
  AccessApprovalMode,
  AccessPreCheckResponse,
} from "../../abstractions/responses/access-pre-check.response";
import { AccessRequestResultResponse } from "../../abstractions/responses/access-request-result.response";

import { RequestAccessFormComponent } from "./request-access-form.component";

/**
 * Echoes the key as its translation, so missing keys don't crash the form-field
 * components and the test assertions stay readable.
 */
const i18nFake: Pick<I18nService, "t" | "translate"> = {
  t: (id: string) => id,
  translate: (id: string) => id,
};

function preCheck(
  approvalMode: AccessApprovalMode,
  hasActiveLease = false,
): AccessPreCheckResponse {
  return new AccessPreCheckResponse({
    CipherId: "cipher-1",
    ApprovalMode: approvalMode,
    HasActiveLease: hasActiveLease,
  });
}

function automaticEnvelope() {
  return new AccessRequestResultResponse({
    Object: "accessRequest",
    ApprovalMode: "automatic",
    Request: {
      Object: "leaseRequest",
      Id: "req-1",
      CipherId: "cipher-1",
      CollectionId: "col-1",
      OrganizationId: "org-1",
      Status: "approved",
      NotBefore: "2026-06-04T12:00:00Z",
      NotAfter: "2026-06-04T13:00:00Z",
      Reason: null,
      CreationDate: "2026-06-04T12:00:00Z",
    },
  });
}

function humanEnvelope() {
  return new AccessRequestResultResponse({
    Object: "accessRequest",
    ApprovalMode: "human",
    Lease: null,
    Request: {
      Object: "leaseRequest",
      Id: "req-1",
      CipherId: "cipher-1",
      CollectionId: "col-1",
      OrganizationId: "org-1",
      Status: "pending",
      NotBefore: "2026-06-05T09:00:00Z",
      NotAfter: "2026-06-05T17:00:00Z",
      Reason: "incident",
      CreationDate: "2026-06-04T12:00:00Z",
    },
  });
}

describe("RequestAccessFormComponent", () => {
  let fixture: ComponentFixture<RequestAccessFormComponent>;
  let component: RequestAccessFormComponent;
  let pamApi: jest.Mocked<Pick<PamApiService, "getAccessPreCheck" | "submitAccessRequest">>;
  let toastService: jest.Mocked<Pick<ToastService, "showToast">>;
  let submittedSpy: jest.Mock;

  const setupComponent = async (mode: AccessApprovalMode, hasActiveLease = false) => {
    pamApi = {
      getAccessPreCheck: jest.fn().mockResolvedValue(preCheck(mode, hasActiveLease)),
      submitAccessRequest: jest.fn(),
    };
    toastService = { showToast: jest.fn() };

    TestBed.configureTestingModule({
      imports: [RequestAccessFormComponent, ReactiveFormsModule],
      providers: [
        { provide: PamApiService, useValue: pamApi },
        { provide: ToastService, useValue: toastService },
        { provide: LogService, useValue: { error: jest.fn() } },
        { provide: I18nService, useValue: i18nFake },
      ],
    });

    fixture = TestBed.createComponent(RequestAccessFormComponent);
    component = fixture.componentInstance;
    submittedSpy = jest.fn();
    component.submitted.subscribe(submittedSpy);

    fixture.componentRef.setInput("cipherId", "cipher-1");
    fixture.detectChanges();
    await fixture.whenStable(); // flush getAccessPreCheck
    fixture.detectChanges(); // render the resolved form
  };

  describe("automatic outcome", () => {
    beforeEach(() => setupComponent("automatic"));

    it("renders the duration picker (no date/time inputs)", () => {
      expect(
        fixture.debugElement.query(By.css("[data-testid='request-access-duration']")),
      ).toBeTruthy();
      expect(fixture.debugElement.query(By.css("[data-testid='request-access-date']"))).toBeNull();
    });

    it("submits with durationSeconds derived from durationMinutes and emits submitted", async () => {
      pamApi.submitAccessRequest.mockResolvedValue(automaticEnvelope());
      component["automaticForm"].patchValue({ durationMinutes: 240, reason: "  incident  " });

      await component["submit"]();

      expect(pamApi.submitAccessRequest).toHaveBeenCalledWith(
        "cipher-1",
        expect.objectContaining({ durationSeconds: 240 * 60, reason: "incident" }),
      );
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success" }),
      );
      expect(submittedSpy).toHaveBeenCalled();
    });

    it("omits reason when blank", async () => {
      pamApi.submitAccessRequest.mockResolvedValue(automaticEnvelope());

      await component["submit"]();

      const body = pamApi.submitAccessRequest.mock.calls[0][1];
      expect(body.reason).toBeUndefined();
    });

    it("rejects a duration over the 24h cap", () => {
      component["automaticForm"].patchValue({ durationMinutes: 24 * 60 + 1 });
      expect(component["automaticForm"].valid).toBe(false);
    });
  });

  describe("human outcome", () => {
    beforeEach(() => setupComponent("human"));

    it("renders the window pickers (no duration select)", () => {
      expect(
        fixture.debugElement.query(By.css("[data-testid='request-access-date']")),
      ).toBeTruthy();
      expect(
        fixture.debugElement.query(By.css("[data-testid='request-access-duration']")),
      ).toBeNull();
    });

    it("requires a non-blank reason", () => {
      component["humanForm"].patchValue({
        customDate: "2026-06-05",
        customStart: "09:00",
        customEnd: "17:00",
        reason: "   ",
      });
      expect(component["humanForm"].valid).toBe(false);

      component["humanForm"].patchValue({ reason: "incident" });
      expect(component["humanForm"].valid).toBe(true);
    });

    it("flags end <= start", () => {
      component["humanForm"].patchValue({
        customDate: "2026-06-05",
        customStart: "17:00",
        customEnd: "09:00",
        reason: "incident",
      });
      expect(component["customWindowEndBeforeStart"]).toBe(true);
    });

    it("submits with start/end ISO strings and trimmed reason and emits submitted", async () => {
      pamApi.submitAccessRequest.mockResolvedValue(humanEnvelope());
      component["humanForm"].patchValue({
        customDate: "2026-06-05",
        customStart: "09:00",
        customEnd: "17:00",
        reason: "  incident  ",
      });

      await component["submit"]();

      const body = pamApi.submitAccessRequest.mock.calls[0][1];
      expect(body.start).toBeDefined();
      expect(body.end).toBeDefined();
      expect(body.reason).toBe("incident");
      expect(body.durationSeconds).toBeUndefined();
      expect(submittedSpy).toHaveBeenCalled();
    });
  });

  describe("pre-check shaping", () => {
    it("emits submitted immediately (no form) when a lease already covers the cipher", async () => {
      await setupComponent("automatic", true);

      expect(submittedSpy).toHaveBeenCalled();
      expect(
        fixture.debugElement.query(By.css("[data-testid='request-access-submit']")),
      ).toBeNull();
    });

    it("surfaces a generic error and renders no form when the pre-check fails", async () => {
      pamApi = {
        getAccessPreCheck: jest.fn().mockRejectedValue(new Error("offline")),
        submitAccessRequest: jest.fn(),
      };
      toastService = { showToast: jest.fn() };
      TestBed.configureTestingModule({
        imports: [RequestAccessFormComponent, ReactiveFormsModule],
        providers: [
          { provide: PamApiService, useValue: pamApi },
          { provide: ToastService, useValue: toastService },
          { provide: LogService, useValue: { error: jest.fn() } },
          { provide: I18nService, useValue: i18nFake },
        ],
      });
      fixture = TestBed.createComponent(RequestAccessFormComponent);
      component = fixture.componentInstance;
      fixture.componentRef.setInput("cipherId", "cipher-1");
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(component["serverError"]()).toBe("requestAccessModalGenericError");
      expect(
        fixture.debugElement.query(By.css("[data-testid='request-access-submit']")),
      ).toBeNull();
    });
  });

  describe("error handling", () => {
    beforeEach(() => setupComponent("automatic"));

    it("maps 'already active' 400 to an info toast + submitted (no inline error)", async () => {
      pamApi.submitAccessRequest.mockRejectedValue(
        new ErrorResponse({ Message: "You already have active access to this item." }, 400),
      );

      await component["submit"]();

      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "info" }),
      );
      expect(submittedSpy).toHaveBeenCalled();
      expect(component["serverError"]()).toBeNull();
    });

    it("maps 'already approved' 400 to an info toast + submitted (no inline error)", async () => {
      pamApi.submitAccessRequest.mockRejectedValue(
        new ErrorResponse({ Message: "You already have an approved request for this item." }, 400),
      );

      await component["submit"]();

      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "info" }),
      );
      expect(submittedSpy).toHaveBeenCalled();
      expect(component["serverError"]()).toBeNull();
    });

    it("maps 'already pending' 400 to submitted", async () => {
      pamApi.submitAccessRequest.mockRejectedValue(
        new ErrorResponse({ Message: "You already have a pending request for this item." }, 400),
      );

      await component["submit"]();

      expect(submittedSpy).toHaveBeenCalled();
    });

    it("surfaces a 'duration exceeds max' 400 inline without emitting submitted", async () => {
      pamApi.submitAccessRequest.mockRejectedValue(
        new ErrorResponse(
          { Message: "The requested duration exceeds the maximum of 86400 seconds." },
          400,
        ),
      );

      await component["submit"]();
      fixture.detectChanges();

      expect(submittedSpy).not.toHaveBeenCalled();
      expect(component["serverError"]()).toContain("86400");
    });

    it("falls back to a generic error for non-400 failures", async () => {
      pamApi.submitAccessRequest.mockRejectedValue(new Error("network"));

      await component["submit"]();

      expect(submittedSpy).not.toHaveBeenCalled();
      expect(component["serverError"]()).toBe("requestAccessModalGenericError");
    });
  });
});
