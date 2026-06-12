import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { combineLatest, of, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  AsyncActionsModule,
  ButtonModule,
  DialogService,
  FormFieldModule,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { CipherAccessState, PamApiService } from "../../abstractions/pam-api.service";
import { AccessApprovalMode } from "../../abstractions/responses/access-pre-check.response";
import { formatRemaining } from "../../helpers/format-remaining";
import {
  LEASE_DURATION_PRESETS,
  MAX_LEASE_DURATION_MINUTES,
  defaultWindowFormValues,
  endAfterStartValidator,
  windowWithinMaxDurationValidator,
} from "../../helpers/lease-window.utils";
import { AccessLeaseExtensionRequest } from "../../services/requests/access-lease-extension.request";
import { AccessLeaseRevokeRequest } from "../../services/requests/access-lease-revoke.request";
import { AccessRequestCreateRequest } from "../../services/requests/access-request-create.request";

/**
 * Server error catalog entries from the PAM lease-request endpoint. Used to
 * surface inline form errors and to detect the reconciliation cases (caller
 * already has access, an approved request, or a pending request) so the banner
 * collapses the fold-out and lets the access-state stream refresh.
 */
const SERVER_ERROR_MESSAGES = Object.freeze({
  ReasonRequired: "A reason is required for items that need human approval.",
  AlreadyActive: "You already have active access to this item.",
  AlreadyApproved: "You already have an approved request for this item.",
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
 * Cipher-view banner for PAM-gated items. Renders the caller's current access
 * state from `getCipherAccessState$` — active lease (reveal + extend/end),
 * approved request ("Start access"), or pending request ("Cancel request") — and,
 * when none of those hold, the "Request access" entry point. Clicking it folds out
 * an inline form (duration for automatic, start/end window + reason for human) that
 * posts to `submitAccessRequest` (PM-37044); on success the fold-out collapses and
 * the access-state stream re-emits to drive the next state. The banner owns all
 * data fetching — the form is just inputs + submit.
 */
@Component({
  selector: "pam-cipher-lease-banner",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "cipher-lease-banner.component.html",
  imports: [
    AsyncActionsModule,
    ButtonModule,
    ReactiveFormsModule,
    FormFieldModule,
    TypographyModule,
    I18nPipe,
  ],
})
export class CipherLeaseBannerComponent implements OnInit {
  readonly cipherId = input.required<string>();
  /**
   * Server-supplied partial-data blob attached to leasing-gated ciphers on
   * sync. Presence is the gating signal: when set, the cipher requires a lease
   * and the "Request access" entry point should render whenever no lease /
   * approved request / pending request exists.
   */
  readonly partialData = input<string | undefined>(undefined);
  /**
   * Client-only marker set when this cipher is served under an active lease — full
   * data, so `partialData` is absent. Together with `partialData` it tells the
   * banner the cipher is PAM-governed and worth a lease-state fetch, so an active
   * lease still drives the countdown / extend / end controls after the reveal.
   */
  readonly leaseGated = input<boolean>(false);

  private readonly destroyRef = inject(DestroyRef);
  private readonly nowMs = signal(Date.now());
  private readonly pamApiService = inject(PamApiService);
  private readonly toastService = inject(ToastService);
  private readonly dialogService = inject(DialogService);
  private readonly i18nService = inject(I18nService);
  private readonly logService = inject(LogService);
  private readonly accountService = inject(AccountService);
  private readonly configService = inject(ConfigService);
  private readonly fb = inject(FormBuilder);
  private readonly pamEnabled = toSignal(this.configService.getFeatureFlag$(FeatureFlag.Pam), {
    initialValue: false,
  });

  /**
   * Whether a lease-state fetch is worthwhile for this cipher: the PAM flag is on
   * AND the cipher is PAM-governed — either still gated (`partialData` present) or
   * served under an active lease (`leaseGated`). Gates the `state` stream so a
   * non-PAM cipher open never fires `GET /ciphers/{id}/lease/state`.
   */
  private readonly leaseStateRelevant = computed(
    () => this.pamEnabled() && (this.partialData() != null || this.leaseGated()),
  );

  /** Whether the "Request access" entry point has folded out its inline form. */
  protected readonly requestFormExpanded = signal(false);

  // Inline request-access form state, populated when the fold-out opens.
  /** Approval workflow resolved by the pre-check; `null` until the fold-out lands it. */
  protected readonly requestMode = signal<AccessApprovalMode | null>(null);
  protected readonly loadingRequestForm = signal(false);
  protected readonly submittingRequest = signal(false);
  protected readonly requestError = signal<string | null>(null);
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

  protected readonly state = toSignal(
    combineLatest([
      toObservable(this.cipherId),
      getUserId(this.accountService.activeAccount$),
      toObservable(this.leaseStateRelevant),
    ]).pipe(
      switchMap(([cipherId, userId, relevant]) =>
        // Only hit GET /ciphers/{id}/lease/state for PAM-governed ciphers (see
        // leaseStateRelevant). A non-PAM cipher open used to fire the call and lean
        // on a server 404 to stay inert; gating on partialData || leaseGated also
        // keeps the active-lease countdown / extend / end controls working after
        // the reveal swaps in the full cipher (partialData gone, leaseGated set).
        relevant
          ? this.pamApiService.getCipherAccessState$(cipherId, userId)
          : of({ lease: {} } as CipherAccessState),
      ),
    ),
    { initialValue: { lease: {} } as CipherAccessState },
  );

  protected readonly activeLease = computed(() => this.state().activeLease);
  protected readonly pendingRequest = computed(() => this.state().pendingRequest);
  protected readonly approvedRequest = computed(() => this.state().approvedRequest);

  /**
   * Show the "Request access" entry point when:
   * - the PAM feature flag is on,
   * - the cipher is gated (has `partialData`),
   * - and there's no active lease / approved request / pending request yet.
   *
   * Clicking it folds out the inline request form (see {@link requestFormExpanded})
   * so the user can request access without leaving the partial cipher view.
   */
  protected readonly canRequestAccess = computed(
    () =>
      this.pamEnabled() &&
      this.partialData() != null &&
      !this.activeLease() &&
      !this.approvedRequest() &&
      !this.pendingRequest(),
  );

  // Parse the ISO `notAfter` once per lease change; without caching the per-second
  // `nowMs()` tick would re-parse the same string 60×/min.
  private readonly activeLeaseExpiryMs = computed(() => {
    const lease = this.activeLease();
    return lease ? Date.parse(lease.notAfter) : 0;
  });

  readonly leaseRemainingLabel = computed(() => {
    if (!this.activeLease()) {
      return "";
    }
    return formatRemaining(this.activeLeaseExpiryMs() - this.nowMs());
  });

  ngOnInit(): void {
    // Only advance the clock while an active lease is showing its countdown;
    // otherwise the per-second tick just churns change detection on a banner
    // that's also mounted for the (countdown-less) request-access entry point.
    const intervalId = setInterval(() => {
      if (this.activeLease()) {
        this.nowMs.set(Date.now());
      }
    }, 1000);
    this.destroyRef.onDestroy(() => clearInterval(intervalId));
  }

  readonly activateLease = async () => {
    const approved = this.approvedRequest();
    if (!approved) {
      return;
    }
    try {
      await this.pamApiService.activateLease(approved.id);
      // `getCipherAccessState$` re-emits on the Activated event; the active-lease
      // branch takes over once the new lease lands.
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamStartLeaseSuccess"),
      });
    } catch (e) {
      this.logService.error(e);
      this.toastService.showToast({
        variant: "error",
        // A taken single-active-lease slot or an org-wide freeze surfaces here;
        // the approved request stays activatable for a manual retry.
        message: this.i18nService.t("pamStartLeaseError"),
      });
    }
  };

  readonly cancelAccessRequest = async () => {
    const request = this.pendingRequest();
    if (!request) {
      return;
    }
    try {
      await this.pamApiService.cancelAccessRequest(request.id);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pendingStateCancelSuccess"),
      });
    } catch (e) {
      this.logService.error(e);
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("pendingStateCancelError"),
      });
    }
  };

  readonly endLease = async () => {
    const lease = this.activeLease();
    if (!lease) {
      return;
    }
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "pamEndLeaseTitle" },
      content: { key: "pamEndLeaseConfirm" },
      acceptButtonText: { key: "pamEndLeaseButton" },
      type: "warning",
    });
    if (!confirmed) {
      return;
    }
    try {
      await this.pamApiService.revokeAccessLease(lease.id, new AccessLeaseRevokeRequest({}));
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamEndLeaseSuccess"),
      });
    } catch (e) {
      this.logService.error(e);
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("errorOccurred"),
      });
    }
  };

  protected get customWindowEndBeforeStart(): boolean {
    return this.humanForm.errors?.["customWindow"] === "endBeforeStart";
  }

  protected get customWindowExceedsMax(): boolean {
    return this.humanForm.errors?.["customWindow"] === "exceedsMaxDuration";
  }

  /**
   * Toggle the "Request access" fold-out. On open, reset the form and resolve the
   * approval workflow via a side-effect-free pre-check, shaping the form (duration
   * for automatic, start/end window for human). The banner owns this fetch so the
   * form below is purely inputs + submit.
   */
  protected async toggleRequestForm(): Promise<void> {
    const next = !this.requestFormExpanded();
    this.requestFormExpanded.set(next);
    if (!next) {
      return;
    }

    this.requestError.set(null);
    this.requestMode.set(null);
    this.automaticForm.reset();
    this.humanForm.reset();
    this.loadingRequestForm.set(true);
    try {
      const preCheck = await this.pamApiService.getAccessPreCheck(this.cipherId());
      if (preCheck.hasActiveLease) {
        // Raced a lease in: reality already matches intent. Collapse and let the
        // state stream reveal the credential — no request to make.
        this.requestFormExpanded.set(false);
        return;
      }
      if (preCheck.approvalMode === "human") {
        this.humanForm.patchValue(defaultWindowFormValues());
      }
      this.requestMode.set(preCheck.approvalMode);
    } catch (e) {
      // Pre-check 404s when the cipher isn't visible or PAM is off; without it we
      // can't shape the form, so surface a generic error.
      this.logService.error(e);
      this.requestError.set(this.i18nService.t("requestAccessModalGenericError"));
    } finally {
      this.loadingRequestForm.set(false);
    }
  }

  protected async submitRequest(): Promise<void> {
    const mode = this.requestMode();
    if (mode == null) {
      return;
    }
    const form = mode === "automatic" ? this.automaticForm : this.humanForm;
    if (form.invalid || this.submittingRequest()) {
      return;
    }
    this.submittingRequest.set(true);
    this.requestError.set(null);

    try {
      const body = mode === "automatic" ? this.buildAutomaticBody() : this.buildHumanBody();
      const response = await this.pamApiService.submitAccessRequest(this.cipherId(), body);

      // Neither path mints a lease at submit: automatic returns an already-approved
      // request the user activates via "Start access"; human returns a pending request
      // awaiting an approver. Collapse; `getCipherAccessState$` re-emits the next state.
      if (response.request) {
        this.toastService.showToast({
          variant: "success",
          message: this.i18nService.t(
            response.approvalMode === "automatic"
              ? "requestAccessModalApprovedSuccess"
              : "requestAccessModalRequestCreatedSuccess",
          ),
        });
        this.requestFormExpanded.set(false);
        return;
      }
      // Envelope carried no request — shouldn't happen on either path; treat as generic.
      this.requestError.set(this.i18nService.t("requestAccessModalGenericError"));
    } catch (e) {
      this.handleRequestError(e);
    } finally {
      this.submittingRequest.set(false);
    }
  }

  readonly extendLease = async () => {
    const lease = this.activeLease();
    if (!lease) {
      return;
    }
    const currentNotAfter = new Date(lease.notAfter);
    const newNotAfter = new Date(currentNotAfter.getTime() + 60 * 60 * 1000);
    try {
      const response = await this.pamApiService.requestLeaseExtension(
        new AccessLeaseExtensionRequest({
          leaseId: lease.id,
          notBefore: currentNotAfter,
          notAfter: newNotAfter,
        }),
      );
      // `getCipherAccessState$` is the source of truth for the eventual outcome;
      // surface a status-appropriate toast and let the next stream emission
      // update the visible countdown.
      const approved = response.status === "approved";
      this.toastService.showToast({
        variant: approved ? "success" : "info",
        message: this.i18nService.t(
          approved ? "pamExtendLeaseSuccess" : "pamExtendLeasePendingMessage",
        ),
      });
    } catch (e) {
      this.logService.error(e);
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("errorOccurred"),
      });
    }
  };

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

  private handleRequestError(e: unknown): void {
    if (e instanceof ErrorResponse && e.statusCode === 400) {
      const msg = e.message ?? "";
      // Reconciliation cases: reality already matches the user's intent. Collapse
      // the fold-out and let the access-state stream refresh.
      if (
        msg === SERVER_ERROR_MESSAGES.AlreadyActive ||
        msg === SERVER_ERROR_MESSAGES.AlreadyApproved ||
        msg === SERVER_ERROR_MESSAGES.AlreadyPending
      ) {
        this.toastService.showToast({
          variant: "info",
          message: this.i18nService.t(this.reconciliationToastKey(msg)),
        });
        this.requestFormExpanded.set(false);
        return;
      }

      const inlineMessage = this.routeInlineError(msg);
      if (inlineMessage != null) {
        this.requestError.set(inlineMessage);
        return;
      }
      // Unmapped 400 — show the raw server message so the user has something
      // actionable; the catalog is small and stable, so this is mostly a safety
      // net for new validation rules added server-side.
      this.requestError.set(msg || this.i18nService.t("requestAccessModalGenericError"));
      return;
    }
    this.logService.error(e);
    this.requestError.set(this.i18nService.t("requestAccessModalGenericError"));
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

  private reconciliationToastKey(serverMessage: string): string {
    switch (serverMessage) {
      case SERVER_ERROR_MESSAGES.AlreadyActive:
        return "requestAccessModalAlreadyActive";
      case SERVER_ERROR_MESSAGES.AlreadyApproved:
        return "requestAccessModalAlreadyApproved";
      default:
        return "requestAccessModalAlreadyPending";
    }
  }
}

function nonBlankValidator() {
  return (control: { value: string | null | undefined }) =>
    typeof control.value === "string" && control.value.trim().length > 0
      ? null
      : { required: true };
}
