import {
  ChangeDetectionStrategy,
  Component,
  Inject,
  OnInit,
  inject,
  signal,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";

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
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import { LeaseExtensionRequest, PamApiService } from "@bitwarden/pam";
import { I18nPipe } from "@bitwarden/ui-common";

export type LeaseExtensionModalData = {
  /** The active lease id to extend. */
  leaseId: string;
  /** The current lease's not_after timestamp (ISO-8601). Defaults the window start. */
  currentNotAfter: string;
};

/**
 * Result returned when the dialog closes.
 *   - "auto_approved" → server bumped `not_after` silently; pill countdown jumps.
 *   - "pending"       → human approver required; pill enters extension_pending state.
 *   - "cancelled"     → user dismissed without submitting.
 */
export const LeaseExtensionResult = Object.freeze({
  AutoApproved: "auto_approved",
  Pending: "pending",
  Cancelled: "cancelled",
} as const);
export type LeaseExtensionResult =
  (typeof LeaseExtensionResult)[keyof typeof LeaseExtensionResult];

/**
 * Extension modal. Mirrors the shape of the request-detail modal (PM-37265)
 * but is scoped to an existing active lease. The window picker defaults to
 * `current not_after → current not_after + 1h`. The optional reason field
 * matches the original request flow.
 *
 * Auto-approve responses carry a `leaseId` on the updated request — the caller
 * can refresh the lease from that. Human-approval flows leave the request in
 * `pending` status.
 */
@Component({
  selector: "pam-lease-extension-modal",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DialogModule,
    ButtonModule,
    FormFieldModule,
    TypographyModule,
    I18nPipe,
  ],
  templateUrl: "./lease-extension-modal.component.html",
})
export class LeaseExtensionModalComponent implements OnInit {
  private readonly pamApi = inject(PamApiService);
  private readonly i18nService = inject(I18nService);
  private readonly toastService = inject(ToastService);
  private readonly logService = inject(LogService);

  protected readonly submitting = signal(false);

  protected readonly form = new FormGroup({
    notBefore: new FormControl<string>("", { nonNullable: true, validators: [Validators.required] }),
    notAfter: new FormControl<string>("", { nonNullable: true, validators: [Validators.required] }),
    reason: new FormControl<string>("", { nonNullable: true }),
  });

  constructor(
    @Inject(DIALOG_DATA) protected readonly data: LeaseExtensionModalData,
    private readonly dialogRef: DialogRef<LeaseExtensionResult>,
  ) {}

  ngOnInit(): void {
    // Default: current not_after → current not_after + 1 hour.
    const currentEnd = new Date(this.data.currentNotAfter);
    const newEnd = new Date(currentEnd.getTime() + 60 * 60 * 1000);
    this.form.patchValue({
      notBefore: toDatetimeLocal(currentEnd),
      notAfter: toDatetimeLocal(newEnd),
    });
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.submitting()) {
      return;
    }
    this.submitting.set(true);

    const { notBefore, notAfter, reason } = this.form.getRawValue();
    const reasonTrimmed = reason.trim();

    try {
      const response = await this.pamApi.requestLeaseExtension(
        new LeaseExtensionRequest({
          leaseId: this.data.leaseId,
          notBefore: new Date(notBefore),
          notAfter: new Date(notAfter),
          reason: reasonTrimmed.length > 0 ? reasonTrimmed : undefined,
        }),
      );

      if (response.status === "approved") {
        this.toastService.showToast({
          variant: "success",
          title: null,
          message: this.i18nService.t("leaseExtensionModalAutoApprovedToast"),
        });
        this.dialogRef.close(LeaseExtensionResult.AutoApproved);
      } else {
        this.toastService.showToast({
          variant: "info",
          title: null,
          message: this.i18nService.t("leaseExtensionModalPendingToast"),
        });
        this.dialogRef.close(LeaseExtensionResult.Pending);
      }
    } catch (e) {
      this.logService.error(e);
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("leaseExtensionModalErrorToast"),
      });
      this.submitting.set(false);
    }
  }

  protected cancel(): void {
    this.dialogRef.close(LeaseExtensionResult.Cancelled);
  }

  static open(
    dialogService: DialogService,
    config: DialogConfig<LeaseExtensionModalData>,
  ): DialogRef<LeaseExtensionResult> {
    return dialogService.open<LeaseExtensionResult, LeaseExtensionModalData>(
      LeaseExtensionModalComponent,
      config,
    );
  }
}

/** Converts a Date to a value compatible with `<input type="datetime-local">`. */
function toDatetimeLocal(d: Date): string {
  // Strips the trailing 'Z' / offset to produce local datetime string.
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}
