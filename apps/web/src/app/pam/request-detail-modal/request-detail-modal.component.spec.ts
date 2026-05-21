import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ReactiveFormsModule } from "@angular/forms";
import { By } from "@angular/platform-browser";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { DIALOG_DATA, DialogRef, I18nMockService, ToastService } from "@bitwarden/components";
import { LeaseRequestResponse, PamApiService } from "@bitwarden/pam";

import {
  RequestDetailModalComponent,
  RequestDetailModalData,
  RequestDetailModalResult,
} from "./request-detail-modal.component";

function makeRequest(
  overrides: Partial<ConstructorParameters<typeof LeaseRequestResponse>[0]> = {},
): LeaseRequestResponse {
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
  let pamApi: jest.Mocked<Pick<PamApiService, "patchLeaseRequest">>;
  let dialogRef: jest.Mocked<Pick<DialogRef<RequestDetailModalResult>, "close">>;
  let toastService: jest.Mocked<Pick<ToastService, "showToast">>;

  const defaultData: RequestDetailModalData = { request: makeRequest() };

  const setupComponent = (data: RequestDetailModalData = defaultData) => {
    pamApi = {
      patchLeaseRequest: jest.fn().mockResolvedValue(makeRequest({ Status: "pending" })),
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
              requestDetailModalDuration: "How long do you need access?",
              requestDetailModalDuration15m: "15 minutes",
              requestDetailModalDuration30m: "30 minutes",
              requestDetailModalDuration1h: "1 hour",
              requestDetailModalDuration4h: "4 hours",
              requestDetailModalDuration8h: "8 hours",
              requestDetailModalDuration1d: "1 day",
              requestDetailModalReason: "Reason (optional)",
              requestDetailModalReasonPlaceholder: "e.g. Incident response",
              requestDetailModalReasonHint: "Visible to approvers.",
              requestDetailModalSubmit: "Request access",
              requestDetailModalDismiss: "Dismiss",
              requestDetailModalSubmitSuccess: "Request submitted.",
              requestDetailModalSubmitError: "Couldn't submit.",
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

  it("defaults duration to 60 minutes when request has no window", () => {
    const form = component["form"];
    expect(form.getRawValue().durationMinutes).toBe(60);
  });

  it("pre-populates duration from request when window matches a preset", () => {
    const now = new Date("2026-06-01T12:00:00Z");
    const after = new Date("2026-06-01T16:00:00Z"); // 4 hours later
    setupComponent({
      request: makeRequest({
        RequestedNotBefore: now.toISOString(),
        RequestedNotAfter: after.toISOString(),
        Reason: "Incident triage",
      }),
    });

    const form = component["form"];
    expect(form.getRawValue().durationMinutes).toBe(240);
    expect(form.getRawValue().reason).toBe("Incident triage");
  });

  it("falls back to 60-minute default when window does not match a preset", () => {
    const now = new Date("2026-06-01T12:00:00Z");
    const after = new Date("2026-06-01T12:45:00Z"); // 45 minutes — not a preset
    setupComponent({
      request: makeRequest({
        RequestedNotBefore: now.toISOString(),
        RequestedNotAfter: after.toISOString(),
      }),
    });

    const form = component["form"];
    expect(form.getRawValue().durationMinutes).toBe(60);
  });

  it("calls patchLeaseRequest with notBefore/notAfter derived from duration and closes with Submitted", async () => {
    const before = Date.now();
    const form = component["form"];
    form.patchValue({ durationMinutes: 240, reason: "Test reason" });

    const submitBtn = fixture.debugElement.query(By.css("[data-testid='request-submit']"))
      ?.nativeElement as HTMLButtonElement;
    submitBtn.click();
    await fixture.whenStable();

    expect(pamApi.patchLeaseRequest).toHaveBeenCalledWith(
      "req-1",
      expect.objectContaining({ reason: "Test reason" }),
    );
    const patch = pamApi.patchLeaseRequest.mock.calls[0][1];
    expect(patch.notAfter!.getTime() - patch.notBefore!.getTime()).toBeCloseTo(240 * 60000, -3);
    expect(patch.notBefore!.getTime()).toBeGreaterThanOrEqual(before);
    expect(dialogRef.close).toHaveBeenCalledWith(RequestDetailModalResult.Submitted);
    expect(toastService.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success" }),
    );
  });

  it("shows error toast and does not close on patchLeaseRequest failure", async () => {
    pamApi.patchLeaseRequest.mockRejectedValue(new Error("network error"));

    const submitBtn = fixture.debugElement.query(By.css("[data-testid='request-submit']"))
      ?.nativeElement as HTMLButtonElement;
    submitBtn.click();
    await fixture.whenStable();

    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(toastService.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "error" }),
    );
  });

  it("closes with Dismissed when dismiss button is clicked — no network call", () => {
    const dismissBtn = fixture.debugElement.query(By.css("[data-testid='request-dismiss']"))
      ?.nativeElement as HTMLButtonElement;
    dismissBtn.click();

    expect(pamApi.patchLeaseRequest).not.toHaveBeenCalled();
    expect(dialogRef.close).toHaveBeenCalledWith(RequestDetailModalResult.Dismissed);
  });
});
