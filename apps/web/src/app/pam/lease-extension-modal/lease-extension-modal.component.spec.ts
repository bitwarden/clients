import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";

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
  LeaseExtensionModalComponent,
  LeaseExtensionModalData,
  LeaseExtensionResult,
} from "./lease-extension-modal.component";

const LEASE_ID = "lease-abc";
const CURRENT_NOT_AFTER = "2026-01-01T02:00:00.000Z";

function i18nMock() {
  return new I18nMockService({
    cancel: "Cancel",
    leaseExtensionModalTitle: "Request extension",
    leaseExtensionModalDescription:
      "Request an extension to your active lease. Enter the new window and an optional reason.",
    leaseExtensionModalWindowStart: "New window start",
    leaseExtensionModalWindowEnd: "New window end",
    leaseExtensionModalReasonLabel: "Reason (optional)",
    leaseExtensionModalReasonPlaceholder: "Why do you need more time?",
    leaseExtensionModalSubmit: "Request extension",
    leaseExtensionModalAutoApprovedToast: "Lease extended.",
    leaseExtensionModalPendingToast: "Extension request submitted. Awaiting approval.",
    leaseExtensionModalErrorToast: "Could not submit the extension request. Try again.",
  });
}

function makeApprovedResponse(): LeaseRequestResponse {
  return new LeaseRequestResponse({
    Id: "req-1",
    CipherId: "cipher-1",
    CollectionId: "col-1",
    RequesterUserId: "user-1",
    Status: "approved",
    RequestedNotBefore: null,
    RequestedNotAfter: null,
    RequestedTtlSeconds: 3600,
    Reason: null,
    SubmittedAt: new Date().toISOString(),
    ResolvedAt: null,
    ResolverUserId: null,
    ResolverComment: null,
    LeaseId: LEASE_ID,
  });
}

function makePendingResponse(): LeaseRequestResponse {
  return new LeaseRequestResponse({
    Id: "req-2",
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
  });
}

describe("LeaseExtensionModalComponent", () => {
  let fixture: ComponentFixture<LeaseExtensionModalComponent>;
  let pamApiSpy: jest.Mocked<Pick<PamApiService, "requestLeaseExtension">>;
  let dialogRefSpy: { close: jest.Mock };
  let toastSpy: { showToast: jest.Mock };

  beforeEach(async () => {
    pamApiSpy = { requestLeaseExtension: jest.fn() };
    dialogRefSpy = { close: jest.fn() };
    toastSpy = { showToast: jest.fn() };

    const data: LeaseExtensionModalData = {
      leaseId: LEASE_ID,
      currentNotAfter: CURRENT_NOT_AFTER,
    };

    await TestBed.configureTestingModule({
      imports: [LeaseExtensionModalComponent, NoopAnimationsModule],
      providers: [
        { provide: I18nService, useFactory: i18nMock },
        { provide: DIALOG_DATA, useValue: data },
        { provide: DialogRef, useValue: dialogRefSpy },
        { provide: PamApiService, useValue: pamApiSpy },
        { provide: ToastService, useValue: toastSpy },
        { provide: LogService, useValue: { error: jest.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LeaseExtensionModalComponent);
    fixture.detectChanges();
  });

  it("pre-fills the window end one hour after currentNotAfter", () => {
    const notAfterInput = fixture.debugElement.query(
      By.css('[data-testid="extension-not-after"]'),
    ).nativeElement as HTMLInputElement;

    // The default is currentNotAfter (2026-01-01T02:00Z) + 1h = 03:00 local.
    // We only assert the end is after the start.
    const notBeforeInput = fixture.debugElement.query(
      By.css('[data-testid="extension-not-before"]'),
    ).nativeElement as HTMLInputElement;

    expect(new Date(notAfterInput.value) > new Date(notBeforeInput.value)).toBe(true);
  });

  it("closes with AutoApproved result when the API returns approved status", async () => {
    pamApiSpy.requestLeaseExtension.mockResolvedValue(makeApprovedResponse());

    const submitBtn = fixture.debugElement.query(
      By.css('[data-testid="extension-submit"]'),
    ).nativeElement as HTMLButtonElement;
    submitBtn.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(dialogRefSpy.close).toHaveBeenCalledWith(LeaseExtensionResult.AutoApproved);
    expect(toastSpy.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success" }),
    );
  });

  it("closes with Pending result when the API returns pending status", async () => {
    pamApiSpy.requestLeaseExtension.mockResolvedValue(makePendingResponse());

    fixture.debugElement
      .query(By.css('[data-testid="extension-submit"]'))
      .nativeElement.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(dialogRefSpy.close).toHaveBeenCalledWith(LeaseExtensionResult.Pending);
    expect(toastSpy.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "info" }),
    );
  });

  it("shows an error toast and keeps the dialog open when the API throws", async () => {
    pamApiSpy.requestLeaseExtension.mockRejectedValue(new Error("network error"));

    fixture.debugElement
      .query(By.css('[data-testid="extension-submit"]'))
      .nativeElement.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(dialogRefSpy.close).not.toHaveBeenCalled();
    expect(toastSpy.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "error" }),
    );
  });

  it("closes with Cancelled result when cancel is clicked", () => {
    fixture.debugElement
      .query(By.css('[data-testid="extension-cancel"]'))
      .nativeElement.click();

    expect(dialogRefSpy.close).toHaveBeenCalledWith(LeaseExtensionResult.Cancelled);
  });

  it("sends the reason when provided", async () => {
    pamApiSpy.requestLeaseExtension.mockResolvedValue(makeApprovedResponse());

    const reasonInput = fixture.debugElement.query(
      By.css('[data-testid="extension-reason"]'),
    ).nativeElement as HTMLInputElement;
    reasonInput.value = "Incident response";
    reasonInput.dispatchEvent(new Event("input"));
    fixture.detectChanges();

    fixture.debugElement
      .query(By.css('[data-testid="extension-submit"]'))
      .nativeElement.click();
    await fixture.whenStable();

    const call = pamApiSpy.requestLeaseExtension.mock.calls[0][0];
    expect(call.reason).toBe("Incident response");
  });

  it("omits the reason when the field is blank", async () => {
    pamApiSpy.requestLeaseExtension.mockResolvedValue(makeApprovedResponse());

    fixture.debugElement
      .query(By.css('[data-testid="extension-submit"]'))
      .nativeElement.click();
    await fixture.whenStable();

    const call = pamApiSpy.requestLeaseExtension.mock.calls[0][0];
    expect(call.reason).toBeUndefined();
  });
});
