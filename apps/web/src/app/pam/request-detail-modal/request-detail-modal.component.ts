import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  Inject,
  OnInit,
  computed,
  inject,
  signal,
} from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";

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
 * approver sees the request. "Submit" patches the server-side LeaseRequest;
 * "Cancel request" deletes it. Dismissing leaves the server-side LeaseRequest
 * intact with its defaults — the cipher view falls back to the pending-state block.
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
  protected readonly cancelling = signal(false);

  protected readonly minDate = computed(() => toDateTimeLocal(new Date()));

  protected readonly form = this.fb.group({
    notBefore: this.fb.control<string>(""),
    notAfter: this.fb.control<string>("", [Validators.required]),
    reason: this.fb.control<string>(""),
  });

  constructor(
    @Inject(DIALOG_DATA) protected readonly data: RequestDetailModalData,
    private readonly dialogRef: DialogRef<RequestDetailModalResult>,
  ) {}

  ngOnInit(): void {
    const req = this.data.request;
    const now = new Date();
    const defaultAfter = new Date(now.getTime() + 60 * 60 * 1000);

    this.form.patchValue({
      notBefore: req.requestedNotBefore
        ? toDateTimeLocal(new Date(req.requestedNotBefore))
        : toDateTimeLocal(now),
      notAfter: req.requestedNotAfter
        ? toDateTimeLocal(new Date(req.requestedNotAfter))
        : toDateTimeLocal(defaultAfter),
      reason: req.reason ?? "",
    });
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.submitting()) {
      return;
    }

    this.submitting.set(true);
    const { notBefore, notAfter, reason } = this.form.getRawValue();

    try {
      await this.pamApi.patchLeaseRequest(
        this.data.request.id,
        new LeaseRequestPatchRequest({
          notBefore: notBefore ? new Date(notBefore) : undefined,
          notAfter: notAfter ? new Date(notAfter) : undefined,
          reason: reason?.trim() || undefined,
        }),
      );
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("requestDetailModalSubmitSuccess"),
      });
      this.dialogRef.close(RequestDetailModalResult.Submitted);
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

  protected async cancelRequest(): Promise<void> {
    if (this.cancelling()) {
      return;
    }
    this.cancelling.set(true);
    try {
      await this.pamApi.cancelLeaseRequest(this.data.request.id);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("requestDetailModalCancelSuccess"),
      });
      this.dialogRef.close(RequestDetailModalResult.Cancelled);
    } catch (e) {
      this.logService.error(e);
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("requestDetailModalCancelError"),
      });
    } finally {
      this.cancelling.set(false);
    }
  }

  protected dismiss(): void {
    this.dialogRef.close(RequestDetailModalResult.Dismissed);
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

/** Converts a Date to `YYYY-MM-DDTHH:mm` for `<input type="datetime-local">`. */
export function toDateTimeLocal(date: Date): string {
  return date.toISOString().slice(0, 16);
}
