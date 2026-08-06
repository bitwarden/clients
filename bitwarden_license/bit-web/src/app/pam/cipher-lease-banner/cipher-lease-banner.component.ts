import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from "@angular/forms";
import { catchError, combineLatest, from, of, switchMap } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  AsyncActionsModule,
  ButtonModule,
  FormFieldModule,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import type {
  AccessApprovalMode,
  AccessRequestCreateRequest,
  CipherAccessStateView,
} from "../abstractions/access-lease";
import { isLeasingError } from "../abstractions/access-lease";
import { AccessRequestSdkService } from "../abstractions/access-request-sdk.service";
import { findHumanDecision, humanApprover } from "../helpers/find-human-decision";
import { ACCESS_RULE_DURATION_PRESETS } from "../helpers/lease-window.utils";

/** Cross-field validator for the human-approval window: the end must be after the start. */
function endAfterStartValidator(group: AbstractControl): ValidationErrors | null {
  const start = group.get("start")?.value;
  const end = group.get("end")?.value;
  if (!start || !end) {
    return null;
  }
  return start < end ? null : { endBeforeStart: true };
}

/** Requires a non-empty, non-whitespace-only value. */
function nonBlankValidator(control: AbstractControl): ValidationErrors | null {
  return typeof control.value === "string" && control.value.trim().length > 0
    ? null
    : { required: true };
}

/**
 * Cipher-view banner for PAM-gated items (bound to `CIPHER_VIEW_BANNER`).
 *
 * Renders the caller's current access state (via
 * {@link AccessRequestSdkService.getCipherAccessState}): an approved request ("Start access"),
 * a pending request (awaiting approval), or — when neither holds and the cipher is gated
 * (`partial`) — the "Request access" entry point. Clicking it folds out an inline form (a
 * duration picker for the automatic path, or a start/end window + reason for the human path,
 * shaped by {@link AccessRequestSdkService.preCheckAccessRequest}) that submits via
 * {@link AccessRequestSdkService.createAccessRequest}. Once approved, "Start access" calls
 * {@link AccessRequestSdkService.activateAccessRequest} to mint the lease; the gated-cipher
 * reloader (`GATED_CIPHER_RELOADER`) then reveals the full cipher in place — this banner does
 * not fetch cipher data itself.
 *
 * Scope note: unlike the reference implementation, this does not offer lease extension/early
 * end from the banner — those live on the "My access" page (`AccessLeaseSdkService`).
 */
@Component({
  selector: "pam-cipher-lease-banner",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./cipher-lease-banner.component.html",
  imports: [
    AsyncActionsModule,
    ButtonModule,
    ReactiveFormsModule,
    FormFieldModule,
    TypographyModule,
    I18nPipe,
  ],
})
export class CipherLeaseBannerComponent {
  readonly cipherId = input.required<string>();
  /** True when the server currently gates this cipher. See `CIPHER_VIEW_BANNER`. */
  readonly partial = input<boolean>(false);
  /** True when this cipher is showing full data because of an active PAM lease. See `CIPHER_VIEW_BANNER`. */
  readonly leaseGated = input<boolean>(false);

  private readonly accessRequestSdkService = inject(AccessRequestSdkService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly logService = inject(LogService);
  private readonly configService = inject(ConfigService);
  private readonly fb = inject(FormBuilder);

  private readonly pamEnabled = toSignal(this.configService.getFeatureFlag$(FeatureFlag.Pam), {
    initialValue: false,
  });

  /** Refetch trigger — bumped after an action so the state stream re-queries. */
  private readonly refresh = signal(0);

  /**
   * Whether an access-state fetch is worthwhile for this cipher: the PAM flag is on AND the
   * cipher is PAM-governed — either still gated (`partial`) or served under an active lease
   * (`leaseGated`). Gates the `state` stream so a non-PAM cipher open never fires a fetch.
   */
  private readonly relevant = computed(
    () => this.pamEnabled() && (this.partial() || this.leaseGated()),
  );

  /** Inert snapshot for a non-PAM-governed cipher (`relevant` is false) or a failed fetch. */
  private readonly emptyState = {} as CipherAccessStateView;

  protected readonly state = toSignal(
    combineLatest([
      toObservable(this.cipherId),
      toObservable(this.relevant),
      toObservable(this.refresh),
    ]).pipe(
      switchMap(([cipherId, relevant]) =>
        relevant
          ? from(this.accessRequestSdkService.getCipherAccessState(cipherId)).pipe(
              // A transient fetch failure shouldn't crash the banner — fall back to "nothing to show".
              catchError((e: unknown) => {
                this.logService.error(e);
                return of(this.emptyState);
              }),
            )
          : of(this.emptyState),
      ),
    ),
    { initialValue: this.emptyState },
  );

  protected readonly activeLease = computed(() => this.state().activeLease);
  protected readonly pendingRequest = computed(() => this.state().pendingRequest);
  protected readonly approvedRequest = computed(() => this.state().approvedRequest);

  /** The human decider's identity on the approved request, when it went through human approval. */
  protected readonly approvedByName = computed(() => {
    const request = this.approvedRequest();
    if (request == null) {
      return null;
    }
    const decision = findHumanDecision(request.decisions);
    if (decision == null) {
      return null;
    }
    const approver = humanApprover(decision);
    return approver?.name ?? approver?.email ?? null;
  });

  /**
   * Show the "Request access" entry point when the cipher is gated and there's no active
   * lease / approved request / pending request yet.
   */
  protected readonly canRequestAccess = computed(
    () =>
      this.pamEnabled() &&
      this.partial() &&
      this.activeLease() == null &&
      this.approvedRequest() == null &&
      this.pendingRequest() == null,
  );

  /** Whether the "Request access" entry point has folded out its inline form. */
  protected readonly requestFormExpanded = signal(false);
  protected readonly loadingRequestForm = signal(false);
  protected readonly requestError = signal<string | null>(null);
  /**
   * Approval workflow resolved by the pre-check; `null` until the fold-out lands it (or it
   * resolves to `"unknown"`, which the template treats the same as "no mode yet").
   */
  protected readonly requestMode = signal<AccessApprovalMode | null>(null);
  protected readonly durationOptions = ACCESS_RULE_DURATION_PRESETS;
  /** Exposed so the template can branch on the approval workflow by name. */
  protected readonly isAutomatic = computed(() => this.requestMode() === "automatic");

  protected readonly automaticForm = this.fb.group({
    durationSeconds: this.fb.nonNullable.control<number>(3600, [
      Validators.required,
      Validators.min(1),
    ]),
    reason: this.fb.nonNullable.control<string>(""),
  });

  protected readonly humanForm = this.fb.group(
    {
      date: this.fb.nonNullable.control<string>("", Validators.required),
      start: this.fb.nonNullable.control<string>("", Validators.required),
      end: this.fb.nonNullable.control<string>("", Validators.required),
      reason: this.fb.nonNullable.control<string>("", [Validators.required, nonBlankValidator]),
    },
    { validators: [endAfterStartValidator] },
  );

  protected get windowEndBeforeStart(): boolean {
    return this.humanForm.errors?.["endBeforeStart"] === true;
  }

  /**
   * Toggle the "Request access" fold-out. On open, reset the forms and resolve the approval
   * workflow via the side-effect-free pre-check, shaping which form renders (duration for
   * automatic, start/end window for human).
   */
  protected async toggleRequestForm(): Promise<void> {
    const next = !this.requestFormExpanded();
    this.requestFormExpanded.set(next);
    if (!next) {
      return;
    }

    this.requestError.set(null);
    this.requestMode.set(null);
    this.automaticForm.reset({ durationSeconds: 3600, reason: "" });
    this.humanForm.reset();
    this.loadingRequestForm.set(true);
    try {
      const preCheck = await this.accessRequestSdkService.preCheckAccessRequest(this.cipherId());
      if (preCheck.hasActiveLease) {
        // Raced a lease in: reality already matches intent. Collapse and let the state stream
        // (bumped below) reveal the credential — no request to make.
        this.requestFormExpanded.set(false);
        this.refresh.update((n) => n + 1);
        return;
      }
      this.requestMode.set(preCheck.approvalMode === "unknown" ? null : preCheck.approvalMode);
      if (preCheck.approvalMode === "unknown") {
        this.requestError.set(this.i18nService.t("pamRequestAccessGenericError"));
      }
    } catch (e) {
      this.logService.error(e);
      this.requestError.set(this.i18nService.t("pamRequestAccessGenericError"));
    } finally {
      this.loadingRequestForm.set(false);
    }
  }

  // `[bitAction]` owns the button's busy/disabled state and serializes re-entrant clicks, so
  // this handler only guards on form validity.
  protected readonly submitRequest = async (): Promise<void> => {
    const mode = this.requestMode();
    if (mode == null) {
      return;
    }
    const form = mode === "automatic" ? this.automaticForm : this.humanForm;
    if (form.invalid) {
      form.markAllAsTouched();
      return;
    }
    this.requestError.set(null);

    try {
      const body = mode === "automatic" ? this.buildAutomaticBody() : this.buildHumanBody();
      const result = await this.accessRequestSdkService.createAccessRequest(this.cipherId(), body);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t(
          result.approvalMode === "automatic"
            ? "pamRequestAccessApprovedSuccess"
            : "pamRequestAccessPendingSuccess",
        ),
      });
      this.requestFormExpanded.set(false);
      this.refresh.update((n) => n + 1);
    } catch (e) {
      this.logService.error(e);
      this.requestError.set(
        isLeasingError(e) ? e.message : this.i18nService.t("pamRequestAccessGenericError"),
      );
    }
  };

  readonly activateApprovedRequest = async (): Promise<void> => {
    const approved = this.approvedRequest();
    if (approved == null) {
      return;
    }
    try {
      await this.accessRequestSdkService.activateAccessRequest(approved.id);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamStartLeaseSuccess"),
      });
      this.refresh.update((n) => n + 1);
    } catch (e) {
      this.logService.error(e);
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("pamStartLeaseError"),
      });
    }
  };

  readonly cancelRequest = async (): Promise<void> => {
    // Covers both a pending request and an approved-but-not-activated one: either can be
    // withdrawn until a lease is minted, after which the lease (not the request) governs access.
    const request = this.pendingRequest() ?? this.approvedRequest();
    if (request == null) {
      return;
    }
    try {
      await this.accessRequestSdkService.cancelAccessRequest(request.id);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamMyRequestsCancelSuccess"),
      });
      this.refresh.update((n) => n + 1);
    } catch (e) {
      this.logService.error(e);
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("pamMyRequestsCancelError"),
      });
    }
  };

  private buildAutomaticBody(): AccessRequestCreateRequest {
    const { durationSeconds, reason } = this.automaticForm.getRawValue();
    return {
      durationSeconds,
      start: undefined,
      end: undefined,
      reason: reason.trim() || undefined,
    };
  }

  private buildHumanBody(): AccessRequestCreateRequest {
    const { date, start, end, reason } = this.humanForm.getRawValue();
    return {
      durationSeconds: undefined,
      start: new Date(`${date}T${start}`).toISOString(),
      end: new Date(`${date}T${end}`).toISOString(),
      reason: reason.trim(),
    };
  }
}
