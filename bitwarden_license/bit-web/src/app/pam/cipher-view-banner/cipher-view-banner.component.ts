import { DatePipe, formatDate } from "@angular/common";
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
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from "@angular/forms";
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
  IconButtonModule,
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
  REQUEST_ACCESS_DURATION_PRESETS,
  type RequestDurationOption,
  type RequestWindowProblem,
  activateAccessErrorMessageKey,
  apiErrorBodyMessage,
  classifyRequestAccessError,
  composeRequestWindow,
  defaultRequestWindow,
  liveActiveLease,
  rereadOnLapse,
  requestDurationOptions,
  requestedWindowSeconds,
  snapToNearestDuration,
  startTimeSlots,
  toDateInputValue,
  toTimeInputValue,
  windowEndAt,
} from "..";
import { ExtendLeaseDialogComponent } from "../access-requests/extend-lease-dialog/extend-lease-dialog.component";
import { ENDING_SOON_THRESHOLD_MS } from "../access-state-badge/access-badge-state";
import { AccessBadgeTickerService } from "../access-state-badge/access-badge-ticker.service";
import { DurationLongPipe } from "../date/duration-long.pipe";
import { DurationShortPipe } from "../date/duration-short.pipe";
import { formatCompoundDuration, formatDuration } from "../date/format-duration";
import { formatRemaining } from "../date/format-remaining";
import { isGovernedCipher } from "../helpers/governed-cipher";
import { isUnlicensedError } from "../helpers/pam-license-error";
import { AccessRequestCancelService } from "../services/access-request-cancel.service";
import { MyLeasesService } from "../services/my-leases.service";
import { callerOrganizations$, unlicensedForPam } from "../services/pam-membership";

import {
  REQUEST_WINDOW_ERROR_KEY,
  type RequestWindowError,
  requestWindowEndValidator,
} from "./request-access-window.validators";

const CUSTOM_OPTION = "custom";

/**
 * Cipher-view banner for PAM-governed items. The unlicensed state replaces every other, since the
 * server withholds the credential from an unlicensed holder regardless of lease.
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
    IconButtonModule,
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
  private readonly ticker = inject(AccessBadgeTickerService);
  private readonly leasingErrorService = inject(LeasingErrorService);
  private readonly configService = inject(ConfigService);
  private readonly accountService = inject(AccountService);
  private readonly organizationService = inject(OrganizationService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly logService = inject(LogService);
  private readonly myLeasesService = inject(MyLeasesService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly ngZone = inject(NgZone);
  private readonly injector = inject(Injector);
  private readonly locale = inject(LOCALE_ID);

  /** Advanced every second while {@link clockAdvances}. */
  private readonly nowMs = signal(Date.now());

  private readonly enabled$ = this.configService.getFeatureFlag$(FeatureFlag.Pam);

  private readonly organizations$ = callerOrganizations$(
    this.accountService,
    this.organizationService,
  );

  /** The open cipher when PAM governs it, else `null`. */
  private readonly governedCipher$ = combineLatest([toObservable(this.cipher), this.enabled$]).pipe(
    switchMap(([cipher, enabled]) => {
      if (!enabled || cipher.id == null) {
        return of(null);
      }
      if (isGovernedCipher(cipher)) {
        return of(cipher);
      }
      // A live lease keeps governing an item that has since become reachable through a rule-less
      // collection, so the holder can still extend or end it.
      return this.myLeasesService
        .hasActiveLease$(String(cipher.id))
        .pipe(map((held) => (held ? cipher : null)));
    }),
    distinctUntilChanged(),
    shareReplay({ refCount: true, bufferSize: 1 }),
  );

  /**
   * The caller's access state, re-read on every {@link AccessRefreshService} change. The
   * gated-cipher reloader shares that trigger, so starting access here also reveals the credential.
   */
  protected readonly state = toSignal(
    this.governedCipher$.pipe(
      switchMap((cipher) => {
        if (cipher == null) {
          return of(null);
        }
        const cipherId = String(cipher.id);
        const read$ = () =>
          from(this.accessRequestSdkService.getCipherAccessState(cipherId)).pipe(
            catchError((e: unknown) => {
              // An unreadable state renders no banner rather than an error, like the vault-row
              // badge.
              this.logService.error(e);
              return of(null);
            }),
          );
        return merge(of(undefined), this.accessRefreshService.accessChanged$(cipherId)).pipe(
          switchMap(() => rereadOnLapse(read$, this.ticker.ticks$)),
        );
      }),
    ),
    { initialValue: null },
  );

  /**
   * Read from local membership state, independent of {@link state}, so the unlicensed block still
   * renders when that read fails.
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

  /** Read against {@link nowMs}, since a lease ends at its `notAfter` without a re-read. */
  protected readonly activeLease = computed(() => liveActiveLease(this.state(), this.nowMs()));
  protected readonly approvedRequest = computed(() => this.state()?.approvedRequest);
  protected readonly pendingRequest = computed(() => this.state()?.pendingRequest);

  /**
   * The granted span from the request's activation window, not the time left to use it, since the
   * lease still ends at `leaseNotAfter`.
   */
  protected readonly approvedDurationSeconds = computed(() => {
    const approved = this.approvedRequest();
    if (approved == null) {
      return null;
    }
    const seconds = requestedWindowSeconds(approved);
    return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
  });

  protected readonly canExtendLease = computed(() => this.state()?.extensionsAllowed === true);

  /**
   * Requires a still-gated (`partial`) cipher. A `leaseGated` cipher without a live lease has
   * lapsed, and its state stream re-drives the resting banner instead.
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
   * The governing rule's terms for the resting banner, from `preCheck`, since {@link state} carries
   * none. `null` when the cap is missing, rather than a made-up limit.
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
   * Escalates at the access-state badge's threshold. Handled here because
   * `ItemDetailsStateBadgeComponent` drops the `active` state on this surface to keep one timer.
   */
  protected readonly leaseEndingSoon = computed(
    () =>
      this.activeLease() != null &&
      this.activeLeaseExpiryMs() - this.nowMs() <= ENDING_SOON_THRESHOLD_MS,
  );

  /** Mirrors `startsNow` in `my-requests-tab.component.ts`, so both describe a window alike. */
  protected readonly approvedRequestStartsNow = computed(() => {
    const request = this.approvedRequest();
    return request != null && Date.parse(request.leaseNotBefore) <= this.nowMs();
  });

  /** Whether anything on screen still reads {@link nowMs}. */
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
  /** `null` until the fold-out's pre-check resolves the approval path. */
  protected readonly requestMode = signal<AccessApprovalMode | null>(null);
  protected readonly loadingRequestForm = signal(false);
  protected readonly requestError = signal<string | null>(null);

  /**
   * The governing rule's bounds from the pre-check. Both paths read the cap here, so the picker and
   * the window validator only offer what submit accepts.
   */
  private readonly requestBounds = signal<{ defaultSeconds: number; maxSeconds: number } | null>(
    null,
  );

  /**
   * Duration choices narrowed to the rule's cap. The unnarrowed fallback never renders, since no
   * form shows until `requestMode` is set along with the bounds.
   */
  protected readonly durationOptions = computed<readonly RequestDurationOption[]>(() => {
    const bounds = this.requestBounds();
    return bounds == null
      ? REQUEST_ACCESS_DURATION_PRESETS
      : requestDurationOptions(bounds.maxSeconds, bounds.defaultSeconds);
  });

  /** The human path's window cap, for the message under the time fields. */
  protected readonly maxWindowSeconds = computed(() => this.requestBounds()?.maxSeconds ?? null);

  /**
   * Start picker floor, pinned when the fold-out opened. Reactive forms ignore `min`, so
   * `requestWindowEndValidator` is the real check.
   */
  protected readonly minRequestDate = signal("");

  /**
   * Set while another member holds the single-active-lease slot. `null` treats free, unknown and
   * unsupported alike.
   */
  protected readonly slotContention = signal<{ freesAt: string | null } | null>(null);

  protected readonly automaticForm = this.formBuilder.nonNullable.group({
    durationSeconds: [DEFAULT_REQUEST_ACCESS_DURATION_SECONDS, Validators.required],
    reason: [""],
  });

  protected readonly humanForm = this.formBuilder.nonNullable.group({
    startDate: ["", Validators.required],
    startTime: ["", Validators.required],
    endDate: ["", Validators.required],
    endTime: [
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

  private readonly humanFormValue = toSignal(this.humanForm.valueChanges, {
    initialValue: this.humanForm.value,
  });

  protected readonly minEndDate = computed(
    () => this.humanFormValue().startDate || this.minRequestDate(),
  );

  protected readonly CUSTOM_OPTION = CUSTOM_OPTION;
  private readonly requestOpenedAt = signal(new Date());
  protected readonly customStart = signal(false);
  protected readonly customEnd = signal(false);
  protected readonly startSlot = new FormControl("", {
    nonNullable: true,
    validators: Validators.required,
  });
  protected readonly endDuration = new FormControl("", {
    nonNullable: true,
    validators: Validators.required,
  });

  protected readonly startSlots = computed(() => {
    const date = this.humanFormValue().startDate;
    if (!date) {
      return [];
    }
    const openedAt = this.requestOpenedAt();
    const today = date === toDateInputValue(openedAt);
    return startTimeSlots(date, openedAt).map((value, index) => {
      const time = formatDate(new Date(`${date}T${value}`), "shortTime", this.locale);
      return {
        value,
        label: today && index === 0 ? this.i18nService.t("requestAccessModalStartNow", time) : time,
      };
    });
  });

  protected readonly endOptions = computed(() => {
    const { startDate, startTime } = this.humanFormValue();
    const start = windowEndAt(startDate, startTime, 0);
    return this.durationOptions().map((option) => {
      const duration = option.labelKey
        ? this.i18nService.t(option.labelKey)
        : formatDuration(this.locale, option.seconds, "long");
      const end = windowEndAt(startDate, startTime, option.seconds);
      return {
        seconds: option.seconds,
        label:
          start == null || end == null
            ? duration
            : this.i18nService.t(
                "requestAccessModalDurationUntil",
                duration,
                this.formatWindowPoint(end, start),
              ),
      };
    });
  });

  protected readonly windowSummary = computed(() => {
    const window = composeRequestWindow(this.humanFormValue());
    if (window == null || window.end <= window.start) {
      return null;
    }
    return this.i18nService.t(
      "requestAccessModalWindowSummary",
      formatCompoundDuration(
        this.locale,
        (window.end.getTime() - window.start.getTime()) / 1000,
        "long",
      ),
      this.formatWindowPoint(window.start),
      this.formatWindowPoint(window.end, window.start),
    );
  });

  private readonly humanFormStatus = toSignal(this.humanForm.statusChanges, {
    initialValue: this.humanForm.status,
  });

  /** The window error while the end is a duration, since the End time field carrying it is hidden. */
  protected readonly durationWindowError = computed(() => {
    this.humanFormStatus();
    this.humanFormValue();
    const error: RequestWindowError | undefined =
      this.humanForm.controls.endTime.errors?.[REQUEST_WINDOW_ERROR_KEY];
    return this.customEnd() ? null : (error?.message ?? null);
  });

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
    const { startDate, startTime, endDate, endTime } = this.humanForm.controls;
    merge(startDate.valueChanges, startTime.valueChanges, endDate.valueChanges)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        endTime.updateValueAndValidity();
        // Only a fresh window error from a sibling edit, so this never nags a blank End or races
        // `BitInputDirective.onInput`'s own `markAsUntouched`.
        if (endTime.errors?.[REQUEST_WINDOW_ERROR_KEY] != null) {
          endTime.markAsTouched();
        }
      });

    this.startSlot.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((value) => {
      if (value === CUSTOM_OPTION) {
        this.customStart.set(true);
      } else {
        startTime.setValue(value);
      }
    });
    this.endDuration.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((value) => {
      if (value === CUSTOM_OPTION) {
        this.customEnd.set(true);
      } else {
        this.followStartWithEnd();
      }
    });
    startDate.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.keepStartOnASlot());
    merge(startDate.valueChanges, startTime.valueChanges)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.followStartWithEnd());

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
   * On open, resets the form and resolves the approval path with a side-effect-free pre-check. A
   * lease that raced in collapses the fold-out and lets the state stream reveal it.
   */
  protected async toggleRequestForm(): Promise<void> {
    const next = !this.requestFormExpanded();
    this.requestFormExpanded.set(next);
    // Toggling unmounts the activated button, which would drop focus to <body>.
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
    this.humanForm.reset({ startDate: "", startTime: "", endDate: "", endTime: "", reason: "" });
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

      const bounds = {
        defaultSeconds: preCheck.defaultDurationSeconds,
        maxSeconds: preCheck.maxDurationSeconds,
      };
      this.requestBounds.set(bounds);

      if (preCheck.approvalMode === "human") {
        // One clock reading for both, so the picker's floor is the day it pre-fills.
        const openedAt = new Date();
        this.minRequestDate.set(toDateInputValue(openedAt));
        this.requestOpenedAt.set(openedAt);
        this.customStart.set(false);
        this.customEnd.set(false);
        this.endDuration.setValue(String(bounds.defaultSeconds), { emitEvent: false });
        this.humanForm.patchValue(defaultRequestWindow(openedAt, bounds.defaultSeconds));
        // `canStartLease` answers about now, not this future window, so no contention warning here.
      } else {
        // `requestDurationOptions` always offers the rule's default, so this select cannot render
        // blank.
        this.automaticForm.patchValue({ durationSeconds: bounds.defaultSeconds });

        // The SDK owns the fail-open default (absent reads as true), so this is a plain boolean.
        if (!preCheck.canStartLease) {
          this.slotContention.set({ freesAt: preCheck.slotFreesAt ?? null });
        }
      }
      this.requestMode.set(preCheck.approvalMode);
    } catch (e) {
      // Without the pre-check the form cannot be shaped, so only the generic error shows.
      this.logService.error(e);
      this.requestError.set(this.i18nService.t("requestAccessModalGenericError"));
    } finally {
      this.loadingRequestForm.set(false);
    }
  }

  protected showStartPresets(): void {
    this.customStart.set(false);
    this.keepStartOnASlot();
  }

  protected showEndPresets(): void {
    const window = composeRequestWindow(this.humanForm.getRawValue());
    const options = this.durationOptions();
    const seconds =
      window == null || options.length === 0
        ? (this.requestBounds()?.defaultSeconds ?? DEFAULT_REQUEST_ACCESS_DURATION_SECONDS)
        : snapToNearestDuration((window.end.getTime() - window.start.getTime()) / 1000, options);
    this.customEnd.set(false);
    this.endDuration.setValue(String(seconds));
  }

  /**
   * In preset mode the start must be an offered slot, or the select renders blank, so this keeps
   * the nearest one at or after it.
   */
  private keepStartOnASlot(): void {
    if (this.customStart()) {
      return;
    }
    const { startDate, startTime } = this.humanForm.controls;
    const slots = startDate.value ? startTimeSlots(startDate.value, this.requestOpenedAt()) : [];
    if (slots.length === 0) {
      return;
    }
    if (slots.includes(startTime.value)) {
      this.startSlot.setValue(startTime.value, { emitEvent: false });
    } else {
      this.startSlot.setValue(slots.find((slot) => slot >= startTime.value) ?? slots[0]);
    }
  }

  /** While the end is a duration, it moves with the start. */
  private followStartWithEnd(): void {
    if (this.customEnd()) {
      return;
    }
    const { startDate, startTime } = this.humanForm.getRawValue();
    const end = windowEndAt(startDate, startTime, Number(this.endDuration.value));
    if (end != null) {
      this.humanForm.patchValue({
        endDate: toDateInputValue(end),
        endTime: toTimeInputValue(end),
      });
    }
  }

  /** A time alone on the reference instant's day, else the day and time. */
  private formatWindowPoint(date: Date, reference?: Date): string {
    const time = formatDate(date, "shortTime", this.locale);
    if (reference != null && toDateInputValue(date) === toDateInputValue(reference)) {
      return time;
    }
    return `${formatDate(date, "EEE, MMM d", this.locale)}, ${time}`;
  }

  private windowProblemMessage(problem: RequestWindowProblem, maxWindowSeconds: number): string {
    switch (problem) {
      case "endNotAfterStart":
        return this.i18nService.t("requestAccessModalEndNotAfterStart");
      case "endInPast":
        return this.i18nService.t("requestAccessModalWindowInPast");
      case "exceedsMaxWindow":
        return this.i18nService.t(
          "requestAccessModalWindowExceedsMax",
          formatDuration(this.locale, maxWindowSeconds, "long"),
        );
    }
  }

  // `[bitAction]` owns the busy state and serialises re-entrant clicks, so this only guards on form
  // validity.
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
      this.humanForm.controls.endTime.updateValueAndValidity();
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
   * Withdraws the pending or approved request. The shared cancel flow toasts the outcome and
   * announces the refresh.
   */
  protected readonly cancelRequest = async (): Promise<void> => {
    const cipherId = this.cipher().id;
    if (cipherId == null || (this.pendingRequest() ?? this.approvedRequest()) == null) {
      return;
    }
    await this.accessRequestCancelService.cancelOutstandingRequest(String(cipherId));
  };

  /**
   * A denied extension resolves rather than throws, so this branches on the returned status, or an
   * expired-lease denial would read as success.
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
        // Reachable only if the seat is withdrawn between render and click; the unlicensed state
        // otherwise replaces this card.
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

  /** Re-reads the state here and lets the gated-cipher reloader reveal or re-lock the item. */
  private notifyAccessChanged(): void {
    // The gate for an ungated-but-leased item reads the cached lease list, which must not outlive
    // a mutation that ended or extended the lease.
    this.myLeasesService.invalidate();
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
    const { reason, ...requested } = this.humanForm.getRawValue();
    const window = composeRequestWindow(requested);
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
   * An "already have this" rejection is not a failure: the fold-out collapses and the re-read shows
   * the state that already exists.
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
      case "exceedsMax":
        // The automatic path's refusal needs pre-check/submit skew, so it echoes the server rather
        // than getting its own string.
        this.requestError.set(
          outcome.scope === "window"
            ? this.windowProblemMessage("exceedsMaxWindow", outcome.maxSeconds)
            : outcome.serverMessage,
        );
        return;
      case "generic":
        this.logService.error(e);
        this.requestError.set(this.i18nService.t("requestAccessModalGenericError"));
        return;
    }
  }
}

/** Rejects a whitespace-only value, since the server requires a non-empty reason. */
function nonBlank(control: { value: unknown }): { required: true } | null {
  return typeof control.value === "string" && control.value.trim().length > 0
    ? null
    : { required: true };
}
