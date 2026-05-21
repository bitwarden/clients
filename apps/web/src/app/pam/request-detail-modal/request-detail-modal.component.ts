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
import { LeaseRequestPatchRequest, LeaseRequestResponse, PamApiService } from "@bitwarden/pam";
import { I18nPipe } from "@bitwarden/ui-common";

export type RequestDetailModalData = {
  /** The server-issued pending lease request (from the 202 response). */
  request: LeaseRequestResponse;
};

export const RequestDetailModalResult = Object.freeze({
  /** User submitted amended details; server was updated. */
  Submitted: "submitted",
  /** User cancelled the request; server was deleted. */
  Cancelled: "cancelled",
  /** User dismissed the modal; no action taken. */
  Dismissed: "dismissed",
} as const);
export type RequestDetailModalResult =
  (typeof RequestDetailModalResult)[keyof typeof RequestDetailModalResult];

/**
 * Modal opened immediately on a 202 (pending) gated-cipher fetch (PM-37265).
 *
 * Lets the requester amend the access window and optional reason before the
 * approver sees the request. "Request access" patches the server-side LeaseRequest;
 * dismissing leaves it intact. A "Set custom window" link reveals date + start/end
 * time fields as an alternative to the preset duration dropdown.
 */
@Component({
  standalone: true,
  selector: "app-request-detail-modal",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./request-detail-modal.component.html",
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
export class RequestDetailModalComponent implements OnInit {
  private readonly pamApi = inject(PamApiService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly logService = inject(LogService);
  private readonly fb = inject(FormBuilder);

  protected readonly submitting = signal(false);
  protected readonly showCustomWindow = signal(false);

  protected readonly durationOptions: { minutes: number; labelKey: string }[] = [
    { minutes: 15, labelKey: "requestDetailModalDuration15m" },
    { minutes: 30, labelKey: "requestDetailModalDuration30m" },
    { minutes: 60, labelKey: "requestDetailModalDuration1h" },
    { minutes: 240, labelKey: "requestDetailModalDuration4h" },
    { minutes: 480, labelKey: "requestDetailModalDuration8h" },
    { minutes: 1440, labelKey: "requestDetailModalDuration1d" },
  ];

  protected readonly form = this.fb.group({
    durationMinutes: this.fb.control<number>(60),
    customDate: this.fb.control<string>(""),
    customStart: this.fb.control<string>(""),
    customEnd: this.fb.control<string>(""),
    reason: this.fb.control<string>(""),
  });

  constructor(
    @Inject(DIALOG_DATA) protected readonly data: RequestDetailModalData,
    private readonly dialogRef: DialogRef<RequestDetailModalResult>,
  ) {}

  ngOnInit(): void {
    const req = this.data.request;
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
      const now = new Date();
      const end = new Date(now.getTime() + (this.form.value.durationMinutes ?? 60) * 60000);
      this.form.patchValue({
        customDate: toDateString(now),
        customStart: toTimeString(now),
        customEnd: toTimeString(end),
      });
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
      await this.pamApi.patchLeaseRequest(
        this.data.request.id,
        new LeaseRequestPatchRequest({
          notBefore,
          notAfter,
          reason: reason?.trim() || undefined,
        }),
      );
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("requestDetailModalSubmitSuccess"),
      });
      void this.dialogRef.close(RequestDetailModalResult.Submitted);
    } catch (e) {
      this.logService.error(e);
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("requestDetailModalSubmitError"),
      });
    } finally {
      this.submitting.set(false);
    }
  }

  protected dismiss(): void {
    void this.dialogRef.close(RequestDetailModalResult.Dismissed);
  }

  /** Opens this modal and returns the ref. Used by the cipher view (PM-37265). */
  static open(
    dialogService: DialogService,
    data: RequestDetailModalData,
  ): DialogRef<RequestDetailModalResult> {
    return dialogService.open<RequestDetailModalResult, RequestDetailModalData>(
      RequestDetailModalComponent,
      { data } satisfies DialogConfig<RequestDetailModalData>,
    );
  }
}

/** Returns `YYYY-MM-DD` for a Date (local time). */
function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Returns `HH:mm` for a Date (local time). */
function toTimeString(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
