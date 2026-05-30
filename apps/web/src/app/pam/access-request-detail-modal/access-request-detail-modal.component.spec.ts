import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ReactiveFormsModule } from "@angular/forms";
import { By } from "@angular/platform-browser";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { DIALOG_DATA, DialogRef, I18nMockService, ToastService } from "@bitwarden/components";
import { AccessRequestResponse, PamApiService } from "@bitwarden/pam";

import {
  AccessRequestDetailModalComponent,
  AccessRequestDetailModalData,
  AccessRequestDetailModalResult,
} from "./access-request-detail-modal.component";

function makeRequest(
  overrides: Partial<ConstructorParameters<typeof AccessRequestResponse>[0]> = {},
): AccessRequestResponse {
  return new AccessRequestResponse({
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

describe("AccessRequestDetailModalComponent", () => {
  let fixture: ComponentFixture<AccessRequestDetailModalComponent>;
  let component: AccessRequestDetailModalComponent;
  let pamApi: jest.Mocked<Pick<PamApiService, "patchAccessRequest">>;
  let dialogRef: jest.Mocked<Pick<DialogRef<AccessRequestDetailModalResult>, "close">>;
  let toastService: jest.Mocked<Pick<ToastService, "showToast">>;

  const defaultData: AccessRequestDetailModalData = { request: makeRequest() };

  const setupComponent = (data: AccessRequestDetailModalData = defaultData) => {
    pamApi = {
      patchAccessRequest: jest.fn().mockResolvedValue(makeRequest({ Status: "pending" })),
    };
    dialogRef = { close: jest.fn() };
    toastService = { showToast: jest.fn() };

    TestBed.configureTestingModule({
      imports: [AccessRequestDetailModalComponent, ReactiveFormsModule],
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
              accessRequestDetailModalTitle: "Request access",
              accessRequestDetailModalDescription: "Amend the access window and reason.",
              accessRequestDetailModalDuration: "How long do you need access?",
              accessRequestDetailModalDuration15m: "15 minutes",
              accessRequestDetailModalDuration30m: "30 minutes",
              accessRequestDetailModalDuration1h: "1 hour",
              accessRequestDetailModalDuration4h: "4 hours",
              accessRequestDetailModalDuration8h: "8 hours",
              accessRequestDetailModalDuration1d: "1 day",
              accessRequestDetailModalReason: "Reason (optional)",
              accessRequestDetailModalReasonPlaceholder: "e.g. Incident response",
              accessRequestDetailModalReasonHint: "Visible to approvers.",
              accessRequestDetailModalSubmit: "Request access",
              accessRequestDetailModalDismiss: "Dismiss",
              accessRequestDetailModalSubmitSuccess: "Request submitted.",
              accessRequestDetailModalSubmitError: "Couldn't submit.",
            }),
        },
      ],
    });

    fixture = TestBed.createComponent(AccessRequestDetailModalComponent);
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

  it("calls patchAccessRequest with notBefore/notAfter derived from duration and closes with Submitted", async () => {
    const before = Date.now();
    const form = component["form"];
    form.patchValue({ durationMinutes: 240, reason: "Test reason" });

    const submitBtn = fixture.debugElement.query(By.css("[data-testid='request-submit']"))
      ?.nativeElement as HTMLButtonElement;
    submitBtn.click();
    await fixture.whenStable();

    expect(pamApi.patchAccessRequest).toHaveBeenCalledWith(
      "req-1",
      expect.objectContaining({ reason: "Test reason" }),
    );
    const patch = pamApi.patchAccessRequest.mock.calls[0][1];
    expect(new Date(patch.notAfter!).getTime() - new Date(patch.notBefore!).getTime()).toBeCloseTo(
      240 * 60000,
      -3,
    );
    expect(new Date(patch.notBefore!).getTime()).toBeGreaterThanOrEqual(before);
    expect(dialogRef.close).toHaveBeenCalledWith(AccessRequestDetailModalResult.Submitted);
    expect(toastService.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success" }),
    );
  });

  it("shows error toast and does not close on patchAccessRequest failure", async () => {
    pamApi.patchAccessRequest.mockRejectedValue(new Error("network error"));

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

    expect(pamApi.patchAccessRequest).not.toHaveBeenCalled();
    expect(dialogRef.close).toHaveBeenCalledWith(AccessRequestDetailModalResult.Dismissed);
  });
});
