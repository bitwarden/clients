import { DatePipe } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  LOCALE_ID,
  NgZone,
  OnInit,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from "@angular/core";
import { takeUntilDestroyed, toObservable, toSignal } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import {
  catchError,
  combineLatest,
  distinctUntilChanged,
  firstValueFrom,
  from,
  map,
  merge,
  of,
  shareReplay,
  switchMap,
} from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
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
  midnightCrossingEnd,
  requestDurationOptions,
  requestedWindowSeconds,
  toDateInputValue,
} from "..";
import { ExtendLeaseDialogComponent } from "../access-requests/extend-lease-dialog/extend-lease-dialog.component";
import { DurationLongPipe } from "../date/duration-long.pipe";
import { DurationShortPipe } from "../date/duration-short.pipe";
import { formatDuration } from "../date/format-duration";
import { formatRemaining } from "../date/format-remaining";
import { isGovernedCipher } from "../helpers/governed-cipher";
import { isUnlicensedError } from "../helpers/pam-license-error";
import { AccessRequestCancelService } from "../services/access-request-cancel.service";
import { callerOrganizations$, unlicensedForPam } from "../services/pam-membership";

import {
  REQUEST_WINDOW_ERROR_KEY,
  requestWindowEndValidator,
} from "./request-access-window.validators";

/**
 * Cipher-view banner for PAM-governed items — the requester's entry point into the leasing flow.
 *
 * Renders one of five states from `getCipherAccessState`: unlicensed, active lease, approved
 * request, pending request, or an inline form; unlicensed replaces every other state, since the
 * server withholds the credential from an unlicensed holder regardless of lease. Refreshes via
 * {@link AccessRefreshService}.
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
  /** The cipher the view is showing, partial when the server gated it. */
  readonly cipher = input.required<CipherView>();

  private readonly accessRequestSdkService = inject(AccessRequestSdkService);
  private readonly accessRequestCancelService = inject(AccessRequestCancelService);
  private readonly accessLeaseSdkService = inject(AccessLeaseSdkService);
  private readonly accessRefreshService = inject(AccessRefreshService);
  private readonly leasingErrorService = inject(LeasingErrorService);
  private readonly configService = inject(ConfigService);
  private readonly accountService = inject(AccountService);
  private readonly organizationService = inject(OrganizationService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly logService = inject(LogService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly ngZone = inject(NgZone);
  private readonly injector = inject(Injector);
  private readonly locale = inject(LOCALE_ID);

  /** Ticks every second so the live countdown and a scheduled window's opening stay current. */
  private readonly nowMs = signal(Date.now());

  private readonly enabled$ = this.configService.getFeatureFlag$(FeatureFlag.Pam);

  private readonly organizations$ = callerOrganizations$(
    this.accountService,
    this.organizationService,
  );

  /**
   * The open cipher once PAM has anything to say about it, `null` otherwise — shared precondition
   * for {@link state} and {@link unlicensed}.
   */
  private readonly governedCipher$ = combineLatest([toObservable(this.cipher), this.enabled$]).pipe(
    map(([cipher, enabled]) =>
      !enabled || cipher.id == null || !isGovernedCipher(cipher) ? null : cipher,
    ),
    distinctUntilChanged(),
    shareReplay({ refCount: true, bufferSize: 1 }),
  );

  /**
   * The caller's access state for the open cipher, re-read on every access change. Reads only for a
   * governed cipher (see {@link governedCipher$}).
   *
   * The re-read trigger is {@link AccessRefreshService}, shared with the gated-cipher reloader, so
   * starting access here also reveals the credential in the item behind this banner.
   */
  protected readonly state = toSignal(
    this.governedCipher$.pipe(
      switchMap((cipher) => {
        if (cipher == null) {
          return of(null);
        }
        const cipherId = String(cipher.id);
        return merge(of(undefined), this.accessRefreshService.accessChanged$(cipherId)).pipe(
          switchMap(() =>
            from(this.accessRequestSdkService.getCipherAccessState(cipherId)).pipe(
              catchError((e: unknown) => {
                // A gated cipher whose state can't be read renders no banner, not an error, matching the
                // vault-row badge.
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

  /**
   * Whether the caller is blocked from privileged access by their own licensing — see
   * {@link unlicensedForPam}. Read from local membership state, independent of {@link state} so
   * the block still renders when that read fails.
   */
  protected readonly unlicensed = toSignal(
    this.governedCipher$.pipe(
      map((cipher) => cipher?.organizationId ?? null),
      distinctUntilChanged(),
      switchMap((organizationId) =>
        organizationId == null
          ? of(false)
          : this.organizations$.pipe(
              map((organizations) =>
                unlicensedForPam(organizations.find((o) => o.id === organizationId)),
              ),
            ),
      ),
    ),
    // `undefined` until the membership read lands, not `false`; treating unknown as licensed
    // would flash the request card.
    { initialValue: undefined },
  );

  protected readonly activeLease = computed(() => this.state()?.activeLease);
  protected readonly approvedRequest = computed(() => this.state()?.approvedRequest);
  protected readonly pendingRequest = computed(() => this.state()?.pendingRequest);

  /**
   * How much access the approval granted, from the request's own activation window — the length of
   * the grant, not the time left to use it, since the lease still ends at `leaseNotAfter`.
   *
   * `null` for a window that does not resolve to a positive span.
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
   * Offer "Request access" only for a still-gated cipher with nothing already in play, held by
   * someone licensed to ask. A cipher that is `leaseGated` but has no active lease has just lapsed;
   * its state stream re-drives the resting banner instead.
   */
  protected readonly canRequestAccess = computed(
    () =>
      this.state() != null &&
      this.cipher().partial &&
      this.unlicensed() === false &&
      this.activeLease() == null &&
      this.approvedRequest() == null &&
      this.pendingRequest() == null,
  );

  /**
   * The governing rule's terms for a request not yet made, from the fold-out's own `preCheck` —
   * {@link state} carries no such fields. `null` when the cap is missing, not a made-up limit.
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

  // Parsed once per lease change, not per tick.
  private readonly activeLeaseExpiryMs = computed(() => {
    const lease = this.activeLease();
    return lease == null ? 0 : Date.parse(lease.notAfter);
  });

  protected readonly leaseRemainingLabel = computed(() =>
    this.activeLease() == null ? "" : formatRemaining(this.activeLeaseExpiryMs() - this.nowMs()),
  );

  /**
   * Whether an approved request's window has already opened — mirrors `startsNow` in
   * `my-requests-tab.component.ts`, so both surfaces describe a granted window the same way.
   */
  protected readonly approvedRequestStartsNow = computed(() => {
    const request = this.approvedRequest();
    return request != null && Date.parse(request.leaseNotBefore) <= this.nowMs();
  });

  /**
   * Whether anything on screen still reads {@link nowMs} — only the active lease's countdown and an
   * approved request awaiting its window.
   */
  private readonly clockAdvances = computed(
    () =>
      this.activeLease() != null ||
      (this.approvedRequest() != null && !this.approvedRequestStartsNow()),
  );

  protected readonly requestFormExpanded = signal(false);
  private readonly requestToggleButton = viewChild("requestToggleButton", {
    read: ElementRef<HTMLElement>,
  });
  private readonly requestFoldOut = viewChild("requestFoldOut", {
    read: ElementRef<HTMLElement>,
  });
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

  /**
   * Floor for the human path's date picker, pinned when the fold-out opened.
   *
   * An affordance only — reactive forms don't read `min`, so `requestWindowEndValidator` is the
   * real check.
   */
  protected readonly minRequestDate = signal("");

  /**
   * `freesAt` for a held single-active-lease slot; `null` means free, unknown, or unsupported —
   * deliberately conflated as free.
   */
  protected readonly slotContention = signal<{ freesAt: string | null } | null>(null);

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
        // Reads the cap live through the signal, not the value captured when the form was built.
        requestWindowEndValidator(
          () => this.maxWindowSeconds(),
          (problem, max) => this.windowProblemMessage(problem, max),
        ),
      ],
    ],
    reason: ["", [Validators.required, nonBlank]],
  });

  /**
   * The human form's live values. Read through a signal rather than off the controls so the
   * next-day hint below recomputes as the requester types; the form's own validity is not enough,
   * since the hint has to move on edits that leave the window perfectly valid.
   */
  private readonly humanFormValue = toSignal(this.humanForm.valueChanges, {
    initialValue: this.humanForm.value,
  });

  /** The end instant when the requested window crosses midnight, `null` otherwise. */
  protected readonly nextDayEnd = computed(() => midnightCrossingEnd(this.humanFormValue()));

  constructor() {
    // Closes the fold-out with the card, or it reopens stale, seeded from an old rule, on remount.
    effect(() => {
      if (!this.canRequestAccess()) {
        this.requestFormExpanded.set(false);
      }
    });
  }

  ngOnInit(): void {
    // Subscribed to the sibling controls, not the group, to avoid re-entrant validation.
    const { date, start, end } = this.humanForm.controls;
    merge(date.valueChanges, start.valueChanges)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        end.updateValueAndValidity();
        // Narrow on purpose: only a fresh window error from a sibling edit, so this never nags a blank
        // End or races `BitInputDirective.onInput`'s own `markAsUntouched`.
        if (end.errors?.[REQUEST_WINDOW_ERROR_KEY] != null) {
          end.markAsTouched();
        }
      });

    // Kept outside the Angular zone: an in-zone periodic timer never lets NgZone settle, which would
    // hang `fixture.whenStable()`. The signal write still drives change detection.
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
    this.requestFormExpanded.set(next);
    // Toggling unmounts the button just activated, dropping focus to <body>; bound to this
    // toggle's own render.
    afterNextRender(
      () => (next ? this.requestFoldOut() : this.requestToggleButton())?.nativeElement.focus(),
      { injector: this.injector },
    );
    if (!next) {
      return;
    }

    this.requestError.set(null);
    this.requestMode.set(null);
    this.requestBounds.set(null);
    this.slotContention.set(null);
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

      // The rule's bounds, read before either form is seeded: both the picker and the default window
      // are built from them.
      const bounds = {
        defaultSeconds: preCheck.defaultDurationSeconds,
        maxSeconds: preCheck.maxDurationSeconds,
      };
      this.requestBounds.set(bounds);

      if (preCheck.approvalMode === "human") {
        // One clock reading for both, so the picker's floor is exactly the day it pre-fills.
        const openedAt = new Date();
        const { date, start, end } = defaultRequestWindow(openedAt, bounds.defaultSeconds);
        this.minRequestDate.set(toDateInputValue(openedAt));
        this.humanForm.patchValue({ date: date ?? "", start: start ?? "", end: end ?? "" });
        // `canStartLease` answers about now, and this window is in the future, so a slot taken right
        // now does not warrant a contention warning.
      } else {
        // Pre-select the rule's own default rather than a hardcoded hour. `requestDurationOptions`
        // guarantees it is one of the offered options, so the select cannot render blank.
        this.automaticForm.patchValue({ durationSeconds: bounds.defaultSeconds });

        // The SDK owns the fail-open default (absent reads as true), so this is a plain boolean.
        if (!preCheck.canStartLease) {
          this.slotContention.set({ freesAt: preCheck.slotFreesAt ?? null });
        }
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
    switch (problem) {
      case "zeroLengthWindow":
        return this.i18nService.t("requestAccessModalEndEqualsStart");
      case "endInPast":
        return this.i18nService.t("requestAccessModalWindowInPast");
      case "exceedsMaxWindow":
        return this.i18nService.t(
          "requestAccessModalWindowExceedsMax",
          formatDuration(this.locale, maxWindowSeconds, "long"),
        );
    }
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
    // `markAllAsTouched` does not re-run validators, so a fold-out left open past its own seeded
    // window still carries a stale verdict; re-validate before trusting `form.invalid`.
    if (mode === "human") {
      this.humanForm.controls.end.updateValueAndValidity();
    }
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
      // Neither path mints a lease at submit; both return a request awaiting activation.
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
   * Extends the active lease through the shared {@link ExtendLeaseDialogComponent}.
   *
   * A resolved-but-denied extension is not a thrown error: branch on the returned status, not
   * try/catch, or an expired-lease denial reads as a successful extension.
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
        // Reachable only if the seat is withdrawn between render and click; `canExtendLease`
        // normally hides this button.
        message: this.i18nService.t(
          isUnlicensedError(e) ? "pamLeaseErrorUnlicensed" : "pamExtendLeaseError",
        ),
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
   * Reconciles a rejected submit. An "already have this" rejection is not a failure: collapse the
   * fold-out and let the re-read settle the banner into the state that already exists.
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
