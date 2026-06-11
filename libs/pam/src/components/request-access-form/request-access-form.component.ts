import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  input,
  output,
  signal,
} from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";

import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  ButtonModule,
  FormFieldModule,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { PamApiService } from "../../abstractions/pam-api.service";
import { AccessApprovalMode } from "../../abstractions/responses/access-pre-check.response";
import {
  LEASE_DURATION_PRESETS,
  MAX_LEASE_DURATION_MINUTES,
  endAfterStartValidator,
  toDateString,
  toTimeString,
  windowWithinMaxDurationValidator,
} from "../../helpers/lease-window.utils";
import { AccessRequestCreateRequest } from "../../services/requests/access-request-create.request";

/**
 * Server error catalog entries from the PAM lease-request endpoint. Used to
 * surface inline form errors and to detect the reconciliation cases (caller
 * already has access or a pending request) so the host banner can refresh.
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
 * Inline "Request access" form embedded in the cipher-lease banner's fold-out.
 * On first render it resolves the approval workflow via `getAccessPreCheck`
 * (side-effect-free) and shapes itself accordingly: a duration picker for
 * automatic, a start/end window with required reason for human. Submitting posts
 * to `submitAccessRequest` (PM-37044). It owns no dialog chrome — the host owns
 * the surface and reacts to {@link submitted} / {@link cancelled}.
 *
 * On a successful submit (or on the reconciliation 400s where reality already
 * matches intent) it emits {@link submitted}; the host collapses the fold-out
 * and the `getCipherAccessState$` stream re-emits to drive the next banner
 * state (active lease → reveal in place, pending request → "Cancel request").
 */
@Component({
  selector: "app-request-access-form",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./request-access-form.component.html",
  imports: [ReactiveFormsModule, ButtonModule, FormFieldModule, TypographyModule, I18nPipe],
})
export class RequestAccessFormComponent implements OnInit {
  readonly cipherId = input.required<string>();

  /** A lease or pending request now exists — the host should collapse and refresh. */
  readonly submitted = output<void>();

  private readonly pamApi = inject(PamApiService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly logService = inject(LogService);
  private readonly fb = inject(FormBuilder);

  /** Approval workflow resolved by the pre-check; `null` until it lands or if it fails. */
  protected readonly mode = signal<AccessApprovalMode | null>(null);
  protected readonly loading = signal(true);
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

  async ngOnInit(): Promise<void> {
    try {
      const preCheck = await this.pamApi.getAccessPreCheck(this.cipherId());
      if (preCheck.hasActiveLease) {
        // Reality already matches intent: a lease covers the cipher. Collapse and
        // let the state stream reveal it — no request to make.
        this.submitted.emit();
        return;
      }
      if (preCheck.approvalMode === "human") {
        this.seedDefaultWindow();
      }
      this.mode.set(preCheck.approvalMode);
    } catch (e) {
      // Pre-check 404s when the cipher isn't visible or PAM is off; without it we
      // can't shape the form, so surface a generic error and offer to back out.
      this.logService.error(e);
      this.serverError.set(this.i18nService.t("requestAccessModalGenericError"));
    } finally {
      this.loading.set(false);
    }
  }

  protected get customWindowEndBeforeStart(): boolean {
    return this.humanForm.errors?.["customWindow"] === "endBeforeStart";
  }

  protected get customWindowExceedsMax(): boolean {
    return this.humanForm.errors?.["customWindow"] === "exceedsMaxDuration";
  }

  protected readonly submit = async (): Promise<void> => {
    const mode = this.mode();
    if (mode == null) {
      return;
    }
    const form = mode === "automatic" ? this.automaticForm : this.humanForm;
    if (form.invalid || this.submitting()) {
      return;
    }
    this.submitting.set(true);
    this.serverError.set(null);

    try {
      const body = mode === "automatic" ? this.buildAutomaticBody() : this.buildHumanBody();
      const response = await this.pamApi.submitAccessRequest(this.cipherId(), body);

      if (response.approvalMode === "automatic" && response.lease) {
        this.toastService.showToast({
          variant: "success",
          message: this.i18nService.t("requestAccessModalLeaseCreatedSuccess"),
        });
        this.submitted.emit();
        return;
      }
      if (response.approvalMode === "human" && response.request) {
        this.toastService.showToast({
          variant: "success",
          message: this.i18nService.t("requestAccessModalRequestCreatedSuccess"),
        });
        this.submitted.emit();
        return;
      }
      // Envelope's outcome / lease / request fields disagreed — treat as a generic error.
      this.serverError.set(this.i18nService.t("requestAccessModalGenericError"));
    } catch (e) {
      this.handleRequestLeaseError(e);
    } finally {
      this.submitting.set(false);
    }
  };

  private seedDefaultWindow(): void {
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
      // Reconciliation cases: reality already matches the user's intent. Collapse
      // the fold-out and let the host refresh banner state.
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
        this.submitted.emit();
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
}

function nonBlankValidator() {
  return (control: { value: string | null | undefined }) =>
    typeof control.value === "string" && control.value.trim().length > 0
      ? null
      : { required: true };
}
