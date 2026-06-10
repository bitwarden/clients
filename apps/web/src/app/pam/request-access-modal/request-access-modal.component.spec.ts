import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ReactiveFormsModule } from "@angular/forms";
import { By } from "@angular/platform-browser";

import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { DIALOG_DATA, DialogRef, ToastService } from "@bitwarden/components";
import { AccessRequestResultResponse, PamApiService } from "@bitwarden/pam";

import {
  RequestAccessModalComponent,
  RequestAccessModalData,
  RequestAccessModalResult,
} from "./request-access-modal.component";

/**
 * Echoes the key as its translation, so missing keys don't crash the form-field
 * components and the test assertions stay readable.
 */
const i18nFake: Pick<I18nService, "t" | "translate"> = {
  t: (id: string) => id,
  translate: (id: string) => id,
};

function automaticEnvelope() {
  return new AccessRequestResultResponse({
    Object: "accessRequest",
    ApprovalMode: "automatic",
    Lease: {
      Object: "lease",
      Id: "lease-1",
      CipherId: "cipher-1",
      CollectionId: "col-1",
      OrganizationId: "org-1",
      Status: "active",
      NotBefore: "2026-06-04T12:00:00Z",
      NotAfter: "2026-06-04T13:00:00Z",
    },
    Request: null,
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

describe("RequestAccessModalComponent", () => {
  let fixture: ComponentFixture<RequestAccessModalComponent>;
  let component: RequestAccessModalComponent;
  let pamApi: jest.Mocked<Pick<PamApiService, "submitAccessRequest">>;
  let dialogRef: jest.Mocked<Pick<DialogRef<unknown>, "close">>;
  let toastService: jest.Mocked<Pick<ToastService, "showToast">>;

  const setupComponent = (data: RequestAccessModalData) => {
    pamApi = { submitAccessRequest: jest.fn() };
    dialogRef = { close: jest.fn() };
    toastService = { showToast: jest.fn() };

    TestBed.configureTestingModule({
      imports: [RequestAccessModalComponent, ReactiveFormsModule],
      providers: [
        { provide: DIALOG_DATA, useValue: data },
        { provide: DialogRef, useValue: dialogRef },
        { provide: PamApiService, useValue: pamApi },
        { provide: ToastService, useValue: toastService },
        { provide: LogService, useValue: { error: jest.fn() } },
        { provide: I18nService, useValue: i18nFake },
      ],
    });

    fixture = TestBed.createComponent(RequestAccessModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  describe("automatic outcome", () => {
    beforeEach(() => setupComponent({ cipherId: "cipher-1", outcome: "automatic" }));

    it("renders the duration picker (no date/time inputs)", () => {
      expect(
        fixture.debugElement.query(By.css("[data-testid='request-access-duration']")),
      ).toBeTruthy();
      expect(fixture.debugElement.query(By.css("[data-testid='request-access-date']"))).toBeNull();
    });

    it("submits with durationSeconds derived from durationMinutes", async () => {
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
      expect(dialogRef.close).toHaveBeenCalledWith(
        expect.objectContaining({ kind: RequestAccessModalResult.LeaseCreated }),
      );
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
    beforeEach(() => setupComponent({ cipherId: "cipher-1", outcome: "human" }));

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

    it("submits with start/end ISO strings and trimmed reason", async () => {
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
      expect(dialogRef.close).toHaveBeenCalledWith(
        expect.objectContaining({ kind: RequestAccessModalResult.RequestCreated }),
      );
    });
  });

  describe("error handling", () => {
    beforeEach(() => setupComponent({ cipherId: "cipher-1", outcome: "automatic" }));

    it("maps 'already active' 400 to AlreadyResolved close + info toast", async () => {
      pamApi.submitAccessRequest.mockRejectedValue(
        new ErrorResponse({ Message: "You already have active access to this item." }, 400),
      );

      await component["submit"]();

      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "info" }),
      );
      expect(dialogRef.close).toHaveBeenCalledWith({
        kind: RequestAccessModalResult.AlreadyResolved,
      });
    });

    it("maps 'already pending' 400 to AlreadyResolved close + info toast", async () => {
      pamApi.submitAccessRequest.mockRejectedValue(
        new ErrorResponse({ Message: "You already have a pending request for this item." }, 400),
      );

      await component["submit"]();

      expect(dialogRef.close).toHaveBeenCalledWith({
        kind: RequestAccessModalResult.AlreadyResolved,
      });
    });

    it("surfaces a 'duration exceeds max' 400 inline without closing", async () => {
      pamApi.submitAccessRequest.mockRejectedValue(
        new ErrorResponse(
          { Message: "The requested duration exceeds the maximum of 86400 seconds." },
          400,
        ),
      );

      await component["submit"]();
      fixture.detectChanges();

      expect(dialogRef.close).not.toHaveBeenCalled();
      expect(component["serverError"]()).toContain("86400");
    });

    it("falls back to a generic error for non-400 failures", async () => {
      pamApi.submitAccessRequest.mockRejectedValue(new Error("network"));

      await component["submit"]();

      expect(dialogRef.close).not.toHaveBeenCalled();
      expect(component["serverError"]()).toBe("requestAccessModalGenericError");
    });
  });

  describe("dismiss", () => {
    beforeEach(() => setupComponent({ cipherId: "cipher-1", outcome: "automatic" }));

    it("closes with Dismissed and does not call the API", () => {
      component["dismiss"]();
      expect(pamApi.submitAccessRequest).not.toHaveBeenCalled();
      expect(dialogRef.close).toHaveBeenCalledWith({
        kind: RequestAccessModalResult.Dismissed,
      });
    });
  });
});
