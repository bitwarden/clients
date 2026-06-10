import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, Inject, OnInit, inject, signal } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";

import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
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
import {
  AccessApprovalMode,
  AccessRequestCreateRequest,
  AccessLeaseResponse,
  AccessRequestResponse,
  PamApiService,
} from "@bitwarden/pam";
import { I18nPipe } from "@bitwarden/ui-common";

import {
  LEASE_DURATION_PRESETS,
  MAX_LEASE_DURATION_MINUTES,
  endAfterStartValidator,
  toDateString,
  toTimeString,
  windowWithinMaxDurationValidator,
} from "../lease-window-form/lease-window.utils";

export type RequestAccessModalData = {
  cipherId: string;
  /** `"active"` mirrors the pre-check hasActiveLease fold the trigger applies. */
  outcome: AccessApprovalMode | "active";
};

export const RequestAccessModalResult = Object.freeze({
  /** Automatic path: an active lease was issued for `[notBefore, notAfter]`. */
  LeaseCreated: "lease-created",
  /** Human path: a pending request was created for an approver. */
  RequestCreated: "request-created",
  /**
   * Server reported the caller already has an active lease or a pending request.
   * Caller should refresh banner state — reality already matches the user's intent.
   */
  AlreadyResolved: "already-resolved",
  /** User dismissed the modal without submitting. */
  Dismissed: "dismissed",
} as const);
export type RequestAccessModalResultKind =
  (typeof RequestAccessModalResult)[keyof typeof RequestAccessModalResult];

export type RequestAccessModalCloseResult =
  | { kind: typeof RequestAccessModalResult.LeaseCreated; lease: AccessLeaseResponse }
  | { kind: typeof RequestAccessModalResult.RequestCreated; request: AccessRequestResponse }
  | { kind: typeof RequestAccessModalResult.AlreadyResolved }
  | { kind: typeof RequestAccessModalResult.Dismissed };

/**
 * Server error catalog entries from the PAM lease-request endpoint. Used to
 * surface inline form errors and to detect the reconciliation cases (caller
 * already has access or a pending request) so the banner can refresh.
 */
const SERVER_ERROR_MESSAGES = Object.freeze({
  ReasonRequired: "A reason is required for items that need human approval.",
  AlreadyActive: "You already have active access to this item.",
  AlreadyPending: "You already have a pending request for this item.",
  AutomaticGotWindow: "This item is approved automatically; provide a duration, not a window.",
  HumanGotDuration:
    "This item requires human approval; provide a start and end date, not a duration.",
  StartBeforeEnd: "The start date must be before the end date.",
  StartEndRequired: "A start and end date are required.",
  PositiveDurationRequired: "A positive duration is required.",
  DurationExceedsMax: "The requested duration exceeds the maximum of 86400 seconds.",
  WindowExceedsMax: "The requested window exceeds the maximum of 86400 seconds.",
  NotLeasingGated: "This item does not require a lease.",
} as const);

/**
 * "Request access" modal opened from the cipher view banner when the user
 * explicitly asks to request a lease on a partial-data cipher. The outcome
 * (`automatic` | `human`) is resolved by `getAccessPreCheck` before opening, so
 * the form is pre-shaped: a duration picker for automatic, a start/end window
 * with required reason for human. Submitting calls `submitAccessRequest` against the
 * new server contract (PM-37044).
 */
@Component({
  standalone: true,
  selector: "app-request-access-modal",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./request-access-modal.component.html",
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
export class RequestAccessModalComponent implements OnInit {
  private readonly pamApi = inject(PamApiService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly logService = inject(LogService);
  private readonly fb = inject(FormBuilder);

  protected readonly submitting = signal(false);
  protected readonly serverError = signal<string | null>(null);

  protected readonly durationOptions = LEASE_DURATION_PRESETS;

  protected readonly automaticForm = this.fb.group({
    durationMinutes: this.fb.nonNullable.control<number>(60, {
      validators: [
        Validators.required,
        Validators.min(1),
        Validators.max(MAX_LEASE_DURATION_MINUTES),
      ],
    }),
    reason: this.fb.nonNullable.control<string>(""),
  });

  protected readonly humanForm = this.fb.group(
    {
      customDate: this.fb.nonNullable.control<string>("", Validators.required),
      customStart: this.fb.nonNullable.control<string>("", Validators.required),
      customEnd: this.fb.nonNullable.control<string>("", Validators.required),
      reason: this.fb.nonNullable.control<string>("", [Validators.required, nonBlankValidator()]),
    },
    { validators: [endAfterStartValidator, windowWithinMaxDurationValidator] },
  );

  constructor(
    @Inject(DIALOG_DATA) protected readonly data: RequestAccessModalData,
    private readonly dialogRef: DialogRef<RequestAccessModalCloseResult>,
  ) {}

  ngOnInit(): void {
    if (this.data.outcome === "human") {
      const now = new Date();
      const end = new Date(now.getTime() + 60 * 60 * 1000);
      const sameDay =
        end.getFullYear() === now.getFullYear() &&
        end.getMonth() === now.getMonth() &&
        end.getDate() === now.getDate();
      this.humanForm.patchValue({
        customDate: toDateString(now),
        customStart: toTimeString(now),
        customEnd: sameDay ? toTimeString(end) : "23:59",
      });
    }
  }

  protected get form() {
    return this.data.outcome === "automatic" ? this.automaticForm : this.humanForm;
  }

  protected get customWindowEndBeforeStart(): boolean {
    return this.humanForm.errors?.["customWindow"] === "endBeforeStart";
  }

  protected get customWindowExceedsMax(): boolean {
    return this.humanForm.errors?.["customWindow"] === "exceedsMaxDuration";
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.submitting()) {
      return;
    }
    this.submitting.set(true);
    this.serverError.set(null);

    try {
      const body =
        this.data.outcome === "automatic" ? this.buildAutomaticBody() : this.buildHumanBody();
      const response = await this.pamApi.submitAccessRequest(this.data.cipherId, body);

      if (response.approvalMode === "automatic" && response.lease) {
        this.toastService.showToast({
          variant: "success",
          message: this.i18nService.t("requestAccessModalLeaseCreatedSuccess"),
        });
        void this.dialogRef.close({
          kind: RequestAccessModalResult.LeaseCreated,
          lease: response.lease,
        });
        return;
      }
      if (response.approvalMode === "human" && response.request) {
        this.toastService.showToast({
          variant: "success",
          message: this.i18nService.t("requestAccessModalRequestCreatedSuccess"),
        });
        void this.dialogRef.close({
          kind: RequestAccessModalResult.RequestCreated,
          request: response.request,
        });
        return;
      }
      // Envelope's outcome / lease / request fields disagreed — treat as a generic error.
      this.serverError.set(this.i18nService.t("requestAccessModalGenericError"));
    } catch (e) {
      this.handleRequestLeaseError(e);
    } finally {
      this.submitting.set(false);
    }
  }

  protected dismiss(): void {
    void this.dialogRef.close({ kind: RequestAccessModalResult.Dismissed });
  }

  private buildAutomaticBody(): AccessRequestCreateRequest {
    const { durationMinutes, reason } = this.automaticForm.getRawValue();
    return new AccessRequestCreateRequest({
      durationSeconds: durationMinutes * 60,
      reason: reason.trim() || undefined,
    });
  }

  private buildHumanBody(): AccessRequestCreateRequest {
    const { customDate, customStart, customEnd, reason } = this.humanForm.getRawValue();
    return new AccessRequestCreateRequest({
      start: new Date(`${customDate}T${customStart}`),
      end: new Date(`${customDate}T${customEnd}`),
      reason: reason.trim(),
    });
  }

  private handleRequestLeaseError(e: unknown): void {
    if (e instanceof ErrorResponse && e.statusCode === 400) {
      const msg = e.message ?? "";
      // Reconciliation cases: reality already matches the user's intent.
      // Close the modal and let the caller refresh banner state.
      if (
        msg === SERVER_ERROR_MESSAGES.AlreadyActive ||
        msg === SERVER_ERROR_MESSAGES.AlreadyPending
      ) {
        this.toastService.showToast({
          variant: "info",
          message:
            msg === SERVER_ERROR_MESSAGES.AlreadyActive
              ? this.i18nService.t("requestAccessModalAlreadyActive")
              : this.i18nService.t("requestAccessModalAlreadyPending"),
        });
        void this.dialogRef.close({ kind: RequestAccessModalResult.AlreadyResolved });
        return;
      }

      const inlineMessage = this.routeInlineError(msg);
      if (inlineMessage != null) {
        this.serverError.set(inlineMessage);
        return;
      }
      // Unmapped 400 — show the raw server message so the user has something
      // actionable; the catalog is small and stable, so this is mostly a safety
      // net for new validation rules added server-side.
      this.serverError.set(msg || this.i18nService.t("requestAccessModalGenericError"));
      return;
    }
    this.logService.error(e);
    this.serverError.set(this.i18nService.t("requestAccessModalGenericError"));
  }

  private routeInlineError(serverMessage: string): string | null {
    switch (serverMessage) {
      case SERVER_ERROR_MESSAGES.ReasonRequired:
        this.humanForm.controls.reason.setErrors({ required: true });
        return this.i18nService.t("requestAccessModalReasonRequired");
      case SERVER_ERROR_MESSAGES.PositiveDurationRequired:
      case SERVER_ERROR_MESSAGES.DurationExceedsMax:
      case SERVER_ERROR_MESSAGES.AutomaticGotWindow:
      case SERVER_ERROR_MESSAGES.HumanGotDuration:
      case SERVER_ERROR_MESSAGES.StartEndRequired:
      case SERVER_ERROR_MESSAGES.StartBeforeEnd:
      case SERVER_ERROR_MESSAGES.WindowExceedsMax:
      case SERVER_ERROR_MESSAGES.NotLeasingGated:
        return serverMessage;
      default:
        return null;
    }
  }

  static open(
    dialogService: DialogService,
    data: RequestAccessModalData,
  ): DialogRef<RequestAccessModalCloseResult> {
    return dialogService.open<RequestAccessModalCloseResult, RequestAccessModalData>(
      RequestAccessModalComponent,
      { data } satisfies DialogConfig<RequestAccessModalData>,
    );
  }
}

function nonBlankValidator() {
  return (control: { value: string | null | undefined }) =>
    typeof control.value === "string" && control.value.trim().length > 0
      ? null
      : { required: true };
}
