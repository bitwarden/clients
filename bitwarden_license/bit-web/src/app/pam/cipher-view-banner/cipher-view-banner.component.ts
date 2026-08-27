import { DatePipe } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  LOCALE_ID,
  NgZone,
  OnInit,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from "@angular/core";
import { takeUntilDestroyed, toObservable, toSignal } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { catchError, combineLatest, firstValueFrom, from, map, merge, of, switchMap } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  AsyncActionsModule,
  ButtonModule,
  CardComponent,
  DialogService,
  FormFieldModule,
  IconModule,
  IconTileComponent,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import {
  type AccessApprovalMode,
  AccessLeaseSdkService,
  AccessRefreshService,
  type AccessRequestCreateRequest,
  AccessRequestSdkService,
  DEFAULT_REQUEST_ACCESS_DURATION_SECONDS,
  LeasingErrorService,
  MAX_REQUEST_ACCESS_WINDOW_SECONDS,
  REQUEST_ACCESS_DURATION_PRESETS,
  type RequestDurationOption,
  type RequestWindowProblem,
  activateAccessErrorMessageKey,
  apiErrorBodyMessage,
  classifyRequestAccessError,
  composeRequestWindow,
  defaultRequestWindow,
  requestDurationOptions,
  requestedWindowSeconds,
} from "..";
import { ExtendLeaseDialogComponent } from "../access-requests/extend-lease-dialog/extend-lease-dialog.component";
import { DurationLongPipe } from "../date/duration-long.pipe";
import { DurationShortPipe } from "../date/duration-short.pipe";
import { formatDuration } from "../date/format-duration";
import { formatRemaining } from "../date/format-remaining";
import { isGovernedCipher } from "../helpers/governed-cipher";
import { AccessRequestCancelService } from "../services/access-request-cancel.service";

import {
  REQUEST_WINDOW_ERROR_KEY,
  requestWindowEndValidator,
} from "./request-access-window.validators";

/**
 * Cipher-view banner for PAM-governed items — the requester's entry point into the leasing flow,
 * bound to `CIPHER_VIEW_BANNER` (see `provide-pam.ts`) so `libs/vault` renders it without depending
 * on this library. Reads the caller's access state for the open cipher via
 * `AccessRequestSdkService.getCipherAccessState` and renders exactly one of four states:
 *
 *  - active lease     — the live countdown, plus Extend and End
 *  - approved request — Start access, or withdraw it
 *  - pending request  — Cancel request while it awaits an approver
 *  - neither          — Request access, folding out an inline form
 *
 * The fold-out's shape comes from a side-effect-free `preCheck`: the `automatic` path collects a
 * duration only, the `human` path a window plus a justification. Every mutation ends by announcing
 * the change on {@link AccessRefreshService}, which re-reads the access state and lets it drive the
 * next state — and, because the gated-cipher reloader listens to the same signal, reveals the
 * credential in the item behind this banner. There is no
 * optimistic local patching here, and a submit that the server rejects because the caller ALREADY
 * holds what they asked for is reconciled the same way (see {@link classifyRequestAccessError}).
 *
 * Server-pushed access events land in a later phase; they will be merged into the same
 * `AccessRefreshService` signal, so nothing here changes when they do.
 */
@Component({
  selector: "app-pam-cipher-view-banner",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./cipher-view-banner.component.html",
  imports: [
    AsyncActionsModule,
    ButtonModule,
    CardComponent,
    FormFieldModule,
    IconModule,
    IconTileComponent,
    ReactiveFormsModule,
    TypographyModule,
    DatePipe,
    DurationLongPipe,
    DurationShortPipe,
    I18nPipe,
  ],
})
export class CipherViewBannerComponent implements OnInit {
  /** The cipher the view is showing — `partial` when the server gated it. */
  readonly cipher = input.required<CipherView>();

  private readonly accessRequestSdkService = inject(AccessRequestSdkService);
  private readonly accessRequestCancelService = inject(AccessRequestCancelService);
  private readonly accessLeaseSdkService = inject(AccessLeaseSdkService);
  private readonly accessRefreshService = inject(AccessRefreshService);
  private readonly leasingErrorService = inject(LeasingErrorService);
  private readonly configService = inject(ConfigService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly logService = inject(LogService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly ngZone = inject(NgZone);
  private readonly locale = inject(LOCALE_ID);

  /** Ticks once a second so the live countdown and a scheduled window's opening stay current. */
  private readonly nowMs = signal(Date.now());

  private readonly enabled$ = this.configService.getFeatureFlag$(FeatureFlag.Pam);

  /**
   * The caller's access state for the open cipher, re-read on every access change.
   *
   * Reads only for a PAM-governed cipher, per {@link isGovernedCipher}, and only while the flag
   * is on.
   *
   * The re-read trigger is {@link AccessRefreshService}, shared with the gated-cipher reloader, so
   * starting access here also reveals the credential in the item behind this banner.
   */
  protected readonly state = toSignal(
    combineLatest([toObservable(this.cipher), this.enabled$]).pipe(
      switchMap(([cipher, enabled]) => {
        if (!enabled || cipher.id == null || !isGovernedCipher(cipher)) {
          return of(null);
        }
        const cipherId = String(cipher.id);
        return merge(of(undefined), this.accessRefreshService.accessChanged$(cipherId)).pipe(
          switchMap(() =>
            from(this.accessRequestSdkService.getCipherAccessState(cipherId)).pipe(
              catchError((e: unknown) => {
                // A gated cipher whose state cannot be read renders no banner rather than an
                // error — the cipher view itself is still useful, and the vault-row badge behaves
                // the same way.
                this.logService.error(e);
                return of(null);
              }),
            ),
          ),
        );
      }),
    ),
    { initialValue: null },
  );

  protected readonly activeLease = computed(() => this.state()?.activeLease);
  protected readonly approvedRequest = computed(() => this.state()?.approvedRequest);
  protected readonly pendingRequest = computed(() => this.state()?.pendingRequest);

  /**
   * How much access the approval granted, from the request's own activation window. This is the
   * length of the grant, not the time still left to use it: the lease ends at `leaseNotAfter`
   * however late it is started, so a request left sitting yields less than this. The absolute
   * expiry that would say so is a separate piece of copy, not yet supplied.
   *
   * Both routes into the approved state resolve the window at submit. An auto-approving rule
   * resolves it from the duration the requester picked, a human approver from the window they asked
   * for, so the same subtraction is right for both.
   *
   * Yields `null` for a window that does not resolve to a positive span, so a malformed one renders
   * no line rather than "0 minutes of access".
   */
  protected readonly approvedDurationSeconds = computed(() => {
    const approved = this.approvedRequest();
    if (approved == null) {
      return null;
    }
    const seconds = requestedWindowSeconds(approved);
    return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
  });

  /** The rule governing the active lease opted into extensions. */
  protected readonly canExtendLease = computed(() => this.state()?.extensionsAllowed === true);

  /**
   * Offer "Request access" only for a still-gated cipher with nothing already in play. A cipher
   * that is `leaseGated` but has no active lease has just lapsed; its state stream re-drives the
   * resting banner instead.
   */
  protected readonly canRequestAccess = computed(
    () =>
      this.state() != null &&
      this.cipher().partial &&
      this.activeLease() == null &&
      this.approvedRequest() == null &&
      this.pendingRequest() == null,
  );

  /**
   * The governing rule's terms for a request nobody has made yet: how long access may run, and
   * whether it would be granted on the spot. Both come from the same side-effect-free `preCheck`
   * the fold-out runs, because the access state read above carries neither. `CipherAccessStateView`
   * publishes only `maxExtensionDurationSeconds`, which caps extending a lease that already exists
   * rather than opening a request.
   *
   * Read only while the resting request-access state is on screen, so a cipher under a lease or
   * with a request in play costs no extra round-trip. The fold-out still runs its own pre-check on
   * open: this one is for display, and `hasActiveLease` has to be resolved against the moment of
   * submit rather than the moment of render.
   *
   * Yields `null` when the cap is missing, so a rule whose bounds the server could not resolve
   * renders no line rather than a made-up limit.
   */
  protected readonly restingRequestTerms = toSignal(
    toObservable(computed(() => (this.canRequestAccess() ? this.cipher().id : null))).pipe(
      switchMap((cipherId) =>
        cipherId == null
          ? of(null)
          : from(this.accessRequestSdkService.preCheck(String(cipherId))).pipe(
              map(({ approvalMode, maxDurationSeconds }) =>
                Number.isFinite(maxDurationSeconds)
                  ? {
                      maxSeconds: maxDurationSeconds,
                      messageKey:
                        approvalMode === "automatic"
                          ? "pamRequestAccessBannerMaxDurationAutomatic"
                          : "pamRequestAccessBannerMaxDuration",
                    }
                  : null,
              ),
              catchError((e: unknown) => {
                this.logService.error(e);
                return of(null);
              }),
            ),
      ),
    ),
    { initialValue: null },
  );

  // Parsed once per lease change: the per-second tick would otherwise re-parse the same ISO string
  // sixty times a minute.
  private readonly activeLeaseExpiryMs = computed(() => {
    const lease = this.activeLease();
    return lease == null ? 0 : Date.parse(lease.notAfter);
  });

  protected readonly leaseRemainingLabel = computed(() =>
    this.activeLease() == null ? "" : formatRemaining(this.activeLeaseExpiryMs() - this.nowMs()),
  );

  /**
   * Whether an approved request's window has already opened — the same question
   * `my-requests-tab.component.ts` asks as `startsNow`, so both surfaces state a granted window the
   * same way: "until X" once it has opened, and the full `notBefore – notAfter` range while it is
   * still scheduled. Without the distinction the banner describes a grant that cannot be started
   * yet as available now.
   */
  protected readonly approvedRequestStartsNow = computed(() => {
    const request = this.approvedRequest();
    return request != null && Date.parse(request.leaseNotBefore) <= this.nowMs();
  });

  /**
   * Whether anything on screen still reads {@link nowMs} — the only two readers are the active
   * lease's countdown and an approved request waiting for its window to open. Everything else the
   * banner renders is fixed for a given state, so ticking outside these two would write a signal
   * once a second, and so run change detection, for a view that cannot move. The approved case is
   * one-way: past its `leaseNotBefore` the branch settles on "until X" and stops needing the clock.
   */
  private readonly clockAdvances = computed(
    () =>
      this.activeLease() != null ||
      (this.approvedRequest() != null && !this.approvedRequestStartsNow()),
  );

  /** Whether the "Request access" entry point has folded out its form. */
  protected readonly requestFormExpanded = signal(false);
  private readonly requestToggleButton = viewChild("requestToggleButton", {
    read: ElementRef<HTMLElement>,
  });
  private readonly requestFoldOut = viewChild("requestFoldOut", {
    read: ElementRef<HTMLElement>,
  });
  private readonly requestFormToggled = signal(false);
  /** Approval path resolved by the pre-check; `null` until the fold-out lands it. */
  protected readonly requestMode = signal<AccessApprovalMode | null>(null);
  protected readonly loadingRequestForm = signal(false);
  protected readonly requestError = signal<string | null>(null);

  /**
   * The duration bounds the pre-check resolved from the governing rule — `null` until the fold-out
   * runs it. Both paths read the cap from here rather than from a local constant, so the picker and
   * the window validator can only offer what submit will accept.
   */
  private readonly requestBounds = signal<{ defaultSeconds: number; maxSeconds: number } | null>(
    null,
  );

  /**
   * The requester's duration choices for the resolved rule, narrowed to its cap. Falls back to the
   * unnarrowed presets before the pre-check lands, which is only ever a transient state: the
   * fold-out renders no form until `requestMode` is set, and that happens with the bounds.
   */
  protected readonly durationOptions = computed<readonly RequestDurationOption[]>(() => {
    const bounds = this.requestBounds();
    return bounds == null
      ? REQUEST_ACCESS_DURATION_PRESETS
      : requestDurationOptions(bounds.maxSeconds, bounds.defaultSeconds);
  });

  /** The cap the human path's window must fit inside, for the message under the time fields. */
  protected readonly maxWindowSeconds = computed(
    () => this.requestBounds()?.maxSeconds ?? MAX_REQUEST_ACCESS_WINDOW_SECONDS,
  );

  protected readonly automaticForm = this.formBuilder.nonNullable.group({
    durationSeconds: [DEFAULT_REQUEST_ACCESS_DURATION_SECONDS, Validators.required],
    reason: [""],
  });

  protected readonly humanForm = this.formBuilder.nonNullable.group({
    date: ["", Validators.required],
    start: ["", Validators.required],
    end: [
      "",
      [
        Validators.required,
        // Reads the cap through the signal on every run, so a fold-out re-opened against a
        // different rule validates against that rule's maximum rather than the one in force when
        // the form was built.
        requestWindowEndValidator(
          () => this.maxWindowSeconds(),
          (problem, max) => this.windowProblemMessage(problem, max),
        ),
      ],
    ],
    reason: ["", [Validators.required, nonBlank]],
  });

  constructor() {
    // Opening unmounts the "Request access" button and collapsing unmounts Cancel, so each
    // direction destroys the element the requester just activated and focus falls to <body>.
    // Latched on the first toggle, so the initial render never pulls focus.
    effect(() => {
      const target = this.requestFormExpanded()
        ? this.requestFoldOut()
        : this.requestToggleButton();
      if (this.requestFormToggled()) {
        target?.nativeElement.focus();
      }
    });
  }

  ngOnInit(): void {
    // A control validator only re-runs on its own control, so without this a window fixed — or
    // broken — by editing Date or Start would leave End's status behind. Subscribed to the two
    // siblings rather than the group, because `updateValueAndValidity` re-emits the group's
    // `valueChanges` and a group subscription would re-enter.
    const { date, start, end } = this.humanForm.controls;
    merge(date.valueChanges, start.valueChanges)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        end.updateValueAndValidity();
        // Narrow on purpose: only a fresh window error, and only from a sibling edit, so this
        // never nags a blank End the requester has not reached and never races
        // `BitInputDirective.onInput`'s `markAsUntouched` on End itself.
        if (end.errors?.[REQUEST_WINDOW_ERROR_KEY] != null) {
          end.markAsTouched();
        }
      });

    // Kept outside the Angular zone: a periodic in-zone timer never lets NgZone settle, which would
    // hang `fixture.whenStable()` for any host embedding the cipher view. The signal write still
    // drives change detection on its own.
    this.ngZone.runOutsideAngular(() => {
      const intervalId = setInterval(() => {
        if (this.clockAdvances()) {
          this.nowMs.set(Date.now());
        }
      }, 1000);
      this.destroyRef.onDestroy(() => clearInterval(intervalId));
    });
  }

  /**
   * Toggle the fold-out. On open, reset the form and resolve the approval path with a
   * side-effect-free pre-check so the form below is purely inputs plus submit. A pre-check that
   * reports an active lease means one raced in — collapse and let the state stream reveal it.
   */
  protected async toggleRequestForm(): Promise<void> {
    const next = !this.requestFormExpanded();
    this.requestFormToggled.set(true);
    this.requestFormExpanded.set(next);
    if (!next) {
      return;
    }

    this.requestError.set(null);
    this.requestMode.set(null);
    this.requestBounds.set(null);
    this.automaticForm.reset({
      durationSeconds: DEFAULT_REQUEST_ACCESS_DURATION_SECONDS,
      reason: "",
    });
    this.humanForm.reset({ date: "", start: "", end: "", reason: "" });
    this.loadingRequestForm.set(true);
    try {
      const cipherId = this.cipher().id;
      if (cipherId == null) {
        return;
      }
      const preCheck = await this.accessRequestSdkService.preCheck(String(cipherId));
      if (preCheck.hasActiveLease) {
        this.requestFormExpanded.set(false);
        this.notifyAccessChanged();
        return;
      }

      // The rule's bounds, before either form is seeded: the automatic path's picker is built from
      // them and the human path's default window is measured against them.
      const bounds = {
        defaultSeconds: preCheck.defaultDurationSeconds,
        maxSeconds: preCheck.maxDurationSeconds,
      };
      this.requestBounds.set(bounds);

      if (preCheck.approvalMode === "human") {
        const { date, start, end } = defaultRequestWindow(new Date(), bounds.defaultSeconds);
        this.humanForm.patchValue({ date: date ?? "", start: start ?? "", end: end ?? "" });
      } else {
        // Pre-select the rule's own default rather than a hardcoded hour. `requestDurationOptions`
        // guarantees it is one of the offered options, so the select cannot render blank.
        this.automaticForm.patchValue({ durationSeconds: bounds.defaultSeconds });
      }
      this.requestMode.set(preCheck.approvalMode);
    } catch (e) {
      // Without the pre-check the form cannot be shaped, so there is nothing useful to show.
      this.logService.error(e);
      this.requestError.set(this.i18nService.t("requestAccessModalGenericError"));
    } finally {
      this.loadingRequestForm.set(false);
    }
  }

  private windowProblemMessage(problem: RequestWindowProblem, maxWindowSeconds: number): string {
    return problem === "endBeforeStart"
      ? this.i18nService.t("requestAccessModalEndBeforeStart")
      : this.i18nService.t(
          "requestAccessModalWindowExceedsMax",
          formatDuration(this.locale, maxWindowSeconds, "long"),
        );
  }

  // `[bitAction]` owns the button's busy state and serialises re-entrant clicks, so this only has to
  // guard on form validity.
  protected readonly submitRequest = async (): Promise<void> => {
    const mode = this.requestMode();
    const cipherId = this.cipher().id;
    if (mode == null || cipherId == null) {
      return;
    }
    const form = mode === "automatic" ? this.automaticForm : this.humanForm;
    form.markAllAsTouched();
    if (form.invalid) {
      return;
    }
    this.requestError.set(null);

    try {
      const request =
        mode === "automatic" ? this.buildAutomaticRequest() : this.buildHumanRequest();
      if (request == null) {
        this.requestError.set(this.i18nService.t("requestAccessModalGenericError"));
        return;
      }
      const result = await this.accessRequestSdkService.submitAccessRequest(
        String(cipherId),
        request,
      );
      // Neither path mints a lease at submit: `automatic` returns an already-approved request the
      // requester starts, `human` one that awaits an approver.
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t(
          result.approvalMode === "automatic"
            ? "requestAccessModalApprovedSuccess"
            : "requestAccessModalRequestCreatedSuccess",
        ),
      });
      this.requestFormExpanded.set(false);
      this.notifyAccessChanged();
    } catch (e) {
      this.handleRequestError(e);
    }
  };

  protected readonly activateRequest = async (): Promise<void> => {
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
    } catch (e) {
      this.logService.error(e);
      // A taken single-active-lease slot surfaces here; the approved request stays activatable.
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t(activateAccessErrorMessageKey(e)),
      });
    } finally {
      this.notifyAccessChanged();
    }
  };

  /**
   * Withdraw whichever request is outstanding — the shared cipher-scoped cancel flow, which
   * covers both a pending request and an approved-but-unactivated one, toasts the outcome, and
   * announces the refresh that drives this banner into its next state.
   */
  protected readonly cancelRequest = async (): Promise<void> => {
    const cipherId = this.cipher().id;
    if (cipherId == null || (this.pendingRequest() ?? this.approvedRequest()) == null) {
      return;
    }
    await this.accessRequestCancelService.cancelOutstandingRequest(String(cipherId));
  };

  /**
   * Extend the active lease through the shared {@link ExtendLeaseDialogComponent} — the same dialog
   * the Requests page uses, so the duration presets and the mandatory justification stay in one
   * place. The rule's `maxExtensionDurationSeconds` is enforced server-side; the dialog does not
   * yet narrow its presets to it, so an over-cap pick surfaces as an error toast.
   *
   * A resolved-but-denied extension is not a failed call, so it does not come back as a thrown
   * error: the lease ran out while this dialog was open, and the server answered with a denied
   * request rather than refusing to record one (PM-42632). Branch on the status the call returns,
   * not on try/catch, or that denial reads as a successful extension.
   */
  protected readonly extendLease = async (): Promise<void> => {
    const lease = this.activeLease();
    if (lease == null) {
      return;
    }
    const request = await firstValueFrom(
      ExtendLeaseDialogComponent.open(this.dialogService).closed,
    );
    if (request == null) {
      return;
    }
    try {
      const extension = await this.accessLeaseSdkService.extendLease(lease.id, request);
      const denied = extension.status === "denied";
      this.toastService.showToast({
        variant: denied ? "warning" : "success",
        message: this.i18nService.t(denied ? "pamExtendLeaseEnded" : "pamExtendLeaseSuccess"),
      });
    } catch (e) {
      this.logService.error(e);
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("pamExtendLeaseError"),
      });
    } finally {
      this.notifyAccessChanged();
    }
  };

  protected readonly endLease = async (): Promise<void> => {
    const lease = this.activeLease();
    if (lease == null) {
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
      await this.accessLeaseSdkService.endLease(lease.id, { reason: undefined });
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
    } finally {
      this.notifyAccessChanged();
    }
  };

  /**
   * Announce that this cipher's access changed, which re-reads the state here and lets the
   * gated-cipher reloader reveal or re-lock the item behind this banner.
   */
  private notifyAccessChanged(): void {
    const cipherId = this.cipher().id;
    if (cipherId != null) {
      this.accessRefreshService.notifyAccessChanged(String(cipherId));
    }
  }

  private buildAutomaticRequest(): AccessRequestCreateRequest {
    const { durationSeconds, reason } = this.automaticForm.getRawValue();
    return {
      durationSeconds: Number(durationSeconds),
      start: undefined,
      end: undefined,
      reason: reason.trim() || undefined,
    };
  }

  private buildHumanRequest(): AccessRequestCreateRequest | null {
    const { date, start, end, reason } = this.humanForm.getRawValue();
    const window = composeRequestWindow({ date, start, end });
    if (window == null) {
      return null;
    }
    return {
      durationSeconds: undefined,
      start: window.start.toISOString(),
      end: window.end.toISOString(),
      reason: reason.trim(),
    };
  }

  /**
   * Reconcile a rejected submit. The three "you already have this" cases are not failures: the
   * requester's intent already holds, so collapse the fold-out, say so as information, and let the
   * re-read drive the banner into the state that exists. Everything else is either a field-level
   * message echoed inline or the generic fallback.
   */
  private handleRequestError(e: unknown): void {
    const message = this.leasingErrorService.isLeasingError(e)
      ? e.message
      : e instanceof Error
        ? e.message
        : undefined;
    const outcome = classifyRequestAccessError(
      message == null ? message : (apiErrorBodyMessage(message) ?? message),
    );

    switch (outcome.kind) {
      case "reconcile":
        this.toastService.showToast({
          variant: "info",
          message: this.i18nService.t(outcome.toastKey),
        });
        this.requestFormExpanded.set(false);
        this.notifyAccessChanged();
        return;
      case "inline":
        if (outcome.field === "reason") {
          this.humanForm.controls.reason.setErrors({ required: true });
        }
        this.requestError.set(outcome.serverMessage);
        return;
      case "generic":
        this.logService.error(e);
        this.requestError.set(this.i18nService.t("requestAccessModalGenericError"));
        return;
    }
  }
}

/** Rejects a control whose value is only whitespace — the server requires a non-empty reason. */
function nonBlank(control: { value: unknown }): { required: true } | null {
  return typeof control.value === "string" && control.value.trim().length > 0
    ? null
    : { required: true };
}
