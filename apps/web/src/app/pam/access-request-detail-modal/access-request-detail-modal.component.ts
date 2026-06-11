import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, Inject, OnInit, inject, signal } from "@angular/core";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  ButtonModule,
  DIALOG_DATA,
  DialogConfig,
  DialogModule,
  DialogRef,
  DialogService,
  FormFieldModule,
  LinkModule,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import {
  AccessRequestPatchRequest,
  AccessRequestDetailsResponse,
  PamApiService,
  LEASE_DURATION_PRESETS,
  defaultWindowFormValues,
  endAfterStartValidator,
} from "@bitwarden/pam";
import { I18nPipe } from "@bitwarden/ui-common";

export type AccessRequestDetailModalData = {
  /** The server-issued pending lease request (from the 202 response). */
  request: AccessRequestDetailsResponse;
};

export const AccessRequestDetailModalResult = Object.freeze({
  /** User submitted amended details; server was updated. */
  Submitted: "submitted",
  /** User dismissed the modal; no action taken. */
  Dismissed: "dismissed",
} as const);
export type AccessRequestDetailModalResult =
  (typeof AccessRequestDetailModalResult)[keyof typeof AccessRequestDetailModalResult];

/**
 * Modal opened immediately on a 202 (pending) gated-cipher fetch (PM-37265).
 *
 * Lets the requester amend the access window and optional reason before the
 * approver sees the request. "Request access" patches the server-side AccessRequest;
 * dismissing leaves it intact. A "Set custom window" link reveals date + start/end
 * time fields as an alternative to the preset duration dropdown.
 */
@Component({
  standalone: true,
  selector: "app-access-request-detail-modal",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./access-request-detail-modal.component.html",
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DialogModule,
    ButtonModule,
    FormFieldModule,
    LinkModule,
    TypographyModule,
    I18nPipe,
  ],
})
export class AccessRequestDetailModalComponent implements OnInit {
  private readonly pamApi = inject(PamApiService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly logService = inject(LogService);
  private readonly fb = inject(FormBuilder);

  protected readonly submitting = signal(false);
  protected readonly showCustomWindow = signal(false);
  /**
   * True when the modal was opened for an already-approved request
   * (CipherOpenAwaitingActivation): the window is fixed, so we offer "Start
   * access" (redemption) instead of the amend-and-submit form.
   */
  protected readonly isApprovedRequest = signal(false);

  protected readonly durationOptions = LEASE_DURATION_PRESETS;

  protected readonly form = this.fb.group(
    {
      durationMinutes: this.fb.control<number>(60),
      customDate: this.fb.control<string>(""),
      customStart: this.fb.control<string>(""),
      customEnd: this.fb.control<string>(""),
      reason: this.fb.control<string>(""),
    },
    // Single-`customDate` shape cannot represent windows that cross midnight;
    // tracked as a separate UX defect.
    { validators: [endAfterStartValidator] },
  );

  constructor(
    @Inject(DIALOG_DATA) protected readonly data: AccessRequestDetailModalData,
    private readonly dialogRef: DialogRef<AccessRequestDetailModalResult>,
  ) {}

  ngOnInit(): void {
    const req = this.data.request;
    this.isApprovedRequest.set(req.status === "approved");
    let durationMinutes = 60;
    if (req.requestedNotBefore && req.requestedNotAfter) {
      const diffMs =
        new Date(req.requestedNotAfter).getTime() - new Date(req.requestedNotBefore).getTime();
      const diffMinutes = Math.round(diffMs / 60000);
      const match = this.durationOptions.find((o) => o.minutes === diffMinutes);
      if (match) {
        durationMinutes = match.minutes;
      }
    }
    this.form.patchValue({ durationMinutes, reason: req.reason ?? "" });
  }

  protected toggleCustomWindow(): void {
    const next = !this.showCustomWindow();
    if (next) {
      this.form.patchValue(defaultWindowFormValues(this.form.value.durationMinutes ?? 60));
    } else {
      // Clear the custom fields so a previously-invalid window doesn't keep the
      // form invalid after the user switches back to the preset duration.
      this.form.patchValue({ customDate: "", customStart: "", customEnd: "" });
    }
    this.showCustomWindow.set(next);
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.submitting()) {
      return;
    }

    this.submitting.set(true);
    const { durationMinutes, customDate, customStart, customEnd, reason } = this.form.getRawValue();

    let notBefore: Date;
    let notAfter: Date;

    if (this.showCustomWindow() && customDate && customStart && customEnd) {
      notBefore = new Date(`${customDate}T${customStart}`);
      notAfter = new Date(`${customDate}T${customEnd}`);
    } else {
      notBefore = new Date();
      notAfter = new Date(notBefore.getTime() + (durationMinutes ?? 60) * 60000);
    }

    try {
      await this.pamApi.patchAccessRequest(
        this.data.request.id,
        new AccessRequestPatchRequest({
          notBefore,
          notAfter,
          reason: reason?.trim() || undefined,
        }),
      );
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("accessRequestDetailModalSubmitSuccess"),
      });
      void this.dialogRef.close(AccessRequestDetailModalResult.Submitted);
    } catch (e) {
      this.logService.error(e);
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("accessRequestDetailModalSubmitError"),
      });
    } finally {
      this.submitting.set(false);
    }
  }

  /** Activates an approved request (MemberStartsLease) and closes the modal. */
  protected async activateLease(): Promise<void> {
    if (this.submitting()) {
      return;
    }
    this.submitting.set(true);
    try {
      await this.pamApi.activateLease(this.data.request.id);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamStartLeaseSuccess"),
      });
      void this.dialogRef.close(AccessRequestDetailModalResult.Submitted);
    } catch (e) {
      this.logService.error(e);
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("pamStartLeaseError"),
      });
    } finally {
      this.submitting.set(false);
    }
  }

  protected dismiss(): void {
    void this.dialogRef.close(AccessRequestDetailModalResult.Dismissed);
  }

  /** Opens this modal and returns the ref. Used by the cipher view (PM-37265). */
  static open(
    dialogService: DialogService,
    data: AccessRequestDetailModalData,
  ): DialogRef<AccessRequestDetailModalResult> {
    return dialogService.open<AccessRequestDetailModalResult, AccessRequestDetailModalData>(
      AccessRequestDetailModalComponent,
      { data } satisfies DialogConfig<AccessRequestDetailModalData>,
    );
  }
}
