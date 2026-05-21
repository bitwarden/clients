import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ReactiveFormsModule } from "@angular/forms";
import { By } from "@angular/platform-browser";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  DIALOG_DATA,
  DialogRef,
  I18nMockService,
  ToastService,
} from "@bitwarden/components";
import { LeaseRequestResponse, PamApiService } from "@bitwarden/pam";

import {
  RequestDetailModalComponent,
  RequestDetailModalData,
  RequestDetailModalResult,
  toDateTimeLocal,
} from "./request-detail-modal.component";

function makeRequest(overrides: Partial<ConstructorParameters<typeof LeaseRequestResponse>[0]> = {}): LeaseRequestResponse {
  return new LeaseRequestResponse({
    Id: "req-1",
    CipherId: "cipher-1",
    CollectionId: "col-1",
    RequesterUserId: "user-1",
    Status: "pending",
    RequestedNotBefore: null,
    RequestedNotAfter: null,
    RequestedTtlSeconds: 3600,
    Reason: null,
    SubmittedAt: new Date().toISOString(),
    ResolvedAt: null,
    ResolverUserId: null,
    ResolverComment: null,
    LeaseId: null,
    ...overrides,
  });
}

describe("RequestDetailModalComponent", () => {
  let fixture: ComponentFixture<RequestDetailModalComponent>;
  let component: RequestDetailModalComponent;
  let pamApi: jest.Mocked<Pick<PamApiService, "patchLeaseRequest" | "cancelLeaseRequest">>;
  let dialogRef: jest.Mocked<Pick<DialogRef<RequestDetailModalResult>, "close">>;
  let toastService: jest.Mocked<Pick<ToastService, "showToast">>;

  const defaultData: RequestDetailModalData = { request: makeRequest() };

  const setupComponent = (data: RequestDetailModalData = defaultData) => {
    pamApi = {
      patchLeaseRequest: jest.fn().mockResolvedValue(makeRequest({ Status: "pending" })),
      cancelLeaseRequest: jest.fn().mockResolvedValue(undefined),
    };
    dialogRef = { close: jest.fn() };
    toastService = { showToast: jest.fn() };

    TestBed.configureTestingModule({
      imports: [RequestDetailModalComponent, ReactiveFormsModule],
      providers: [
        { provide: DIALOG_DATA, useValue: data },
        { provide: DialogRef, useValue: dialogRef },
        { provide: PamApiService, useValue: pamApi },
        { provide: ToastService, useValue: toastService },
        { provide: LogService, useValue: { error: jest.fn() } },
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              requestDetailModalTitle: "Request access",
              requestDetailModalDescription: "Amend the access window and reason.",
              requestDetailModalNotBefore: "Access from",
              requestDetailModalNotAfter: "Access until",
              requestDetailModalNotAfterHint: "When your access window ends.",
              requestDetailModalReason: "Reason (optional)",
              requestDetailModalReasonPlaceholder: "e.g. Incident response",
              requestDetailModalReasonHint: "Visible to approvers.",
              requestDetailModalSubmit: "Submit",
              requestDetailModalCancelRequest: "Cancel request",
              requestDetailModalDismiss: "Dismiss",
              requestDetailModalSubmitSuccess: "Request submitted.",
              requestDetailModalSubmitError: "Couldn't submit.",
              requestDetailModalCancelSuccess: "Request cancelled.",
              requestDetailModalCancelError: "Couldn't cancel.",
            }),
        },
      ],
    });

    fixture = TestBed.createComponent(RequestDetailModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  beforeEach(() => setupComponent());

  it("renders the modal without errors", () => {
    expect(fixture.debugElement).toBeTruthy();
  });

  it("pre-populates notAfter to now+1h when request has no window", () => {
    const notAfterInput = fixture.debugElement.query(
      By.css("[data-testid='request-not-after']"),
    )?.nativeElement as HTMLInputElement;
    expect(notAfterInput?.value).toBeTruthy();
  });

  it("pre-populates fields from request when window is set", () => {
    const now = new Date("2026-06-01T12:00:00Z");
    const after = new Date("2026-06-01T13:00:00Z");
    setupComponent({
      request: makeRequest({
        RequestedNotBefore: now.toISOString(),
        RequestedNotAfter: after.toISOString(),
        Reason: "Incident triage",
      }),
    });

    const form = component["form"];
    expect(form.getRawValue().notBefore).toBe(toDateTimeLocal(now));
    expect(form.getRawValue().notAfter).toBe(toDateTimeLocal(after));
    expect(form.getRawValue().reason).toBe("Incident triage");
  });

  it("calls patchLeaseRequest with form values and closes with Submitted on submit", async () => {
    const form = component["form"];
    form.patchValue({ reason: "Test reason" });

    const submitBtn = fixture.debugElement.query(
      By.css("[data-testid='request-submit']"),
    )?.nativeElement as HTMLButtonElement;
    submitBtn.click();
    await fixture.whenStable();

    expect(pamApi.patchLeaseRequest).toHaveBeenCalledWith(
      "req-1",
      expect.objectContaining({ reason: "Test reason" }),
    );
    expect(dialogRef.close).toHaveBeenCalledWith(RequestDetailModalResult.Submitted);
    expect(toastService.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success" }),
    );
  });

  it("shows error toast and does not close on patchLeaseRequest failure", async () => {
    pamApi.patchLeaseRequest.mockRejectedValue(new Error("network error"));

    const submitBtn = fixture.debugElement.query(
      By.css("[data-testid='request-submit']"),
    )?.nativeElement as HTMLButtonElement;
    submitBtn.click();
    await fixture.whenStable();

    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(toastService.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "error" }),
    );
  });

  it("calls cancelLeaseRequest and closes with Cancelled when cancel is clicked", async () => {
    const cancelBtn = fixture.debugElement.query(
      By.css("[data-testid='request-cancel']"),
    )?.nativeElement as HTMLButtonElement;
    cancelBtn.click();
    await fixture.whenStable();

    expect(pamApi.cancelLeaseRequest).toHaveBeenCalledWith("req-1");
    expect(dialogRef.close).toHaveBeenCalledWith(RequestDetailModalResult.Cancelled);
  });

  it("shows error toast and does not close on cancelLeaseRequest failure", async () => {
    pamApi.cancelLeaseRequest.mockRejectedValue(new Error("network error"));

    const cancelBtn = fixture.debugElement.query(
      By.css("[data-testid='request-cancel']"),
    )?.nativeElement as HTMLButtonElement;
    cancelBtn.click();
    await fixture.whenStable();

    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(toastService.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "error" }),
    );
  });

  it("closes with Dismissed when dismiss button is clicked — no network call", () => {
    const dismissBtn = fixture.debugElement.query(
      By.css("[data-testid='request-dismiss']"),
    )?.nativeElement as HTMLButtonElement;
    dismissBtn.click();

    expect(pamApi.patchLeaseRequest).not.toHaveBeenCalled();
    expect(pamApi.cancelLeaseRequest).not.toHaveBeenCalled();
    expect(dialogRef.close).toHaveBeenCalledWith(RequestDetailModalResult.Dismissed);
  });
});

describe("toDateTimeLocal", () => {
  it("formats a date as YYYY-MM-DDTHH:mm", () => {
    const date = new Date("2026-06-01T09:30:00.000Z");
    const result = toDateTimeLocal(date);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });
});
