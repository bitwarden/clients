import { A11yModule } from "@angular/cdk/a11y";
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  LOCALE_ID,
  OnInit,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from "@angular/forms";
import { merge } from "rxjs";

import {
  type AccessApprovalMode,
  type AccessRequestCreateRequest,
  AccessRequestSdkService,
  apiErrorBodyMessage,
  LeasingErrorService,
  ACCESS_BADGE_LOOK,
  formatCompoundDuration,
  formatDuration,
  formatTimeOfDay,
  formatTimestamp,
  DEFAULT_REQUEST_ACCESS_DURATION_SECONDS,
  REQUEST_ACCESS_DURATION_PRESETS,
  type RequestDurationOption,
  requestDurationOptions,
  snapToNearestDuration,
  classifyRequestAccessError,
  type RequestWindowProblem,
  composeRequestWindow,
  defaultRequestWindow,
  startTimeSlots,
  toDateInputValue,
  toTimeInputValue,
  windowEndAt,
} from "@bitwarden/bit-pam";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  AsyncActionsModule,
  ButtonModule,
  FormFieldModule,
  IconButtonModule,
  IconModule,
  IconTileComponent,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { DurationLongPipe } from "../../date/duration-long.pipe";
import { DurationShortPipe } from "../../date/duration-short.pipe";
import { TimestampPipe } from "../../date/timestamp.pipe";
import {
  REQUEST_WINDOW_ERROR_KEY,
  type RequestWindowError,
  requestWindowEndValidator,
} from "../request-access-window.validators";
import type { RequestTerms } from "../request-terms";

const CUSTOM_OPTION = "custom";

/**
 * The bottom sheet a requester fills in to ask for access to a governed item. Each mount resolves
 * the approval path with a side-effect-free pre-check and shapes the form from it.
 */
@Component({
  selector: "app-pam-request-access-sheet",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./request-access-sheet.component.html",
  imports: [
    A11yModule,
    AsyncActionsModule,
    ButtonModule,
    FormFieldModule,
    IconButtonModule,
    IconModule,
    IconTileComponent,
    ReactiveFormsModule,
    TypographyModule,
    DurationLongPipe,
    DurationShortPipe,
    I18nPipe,
    TimestampPipe,
  ],
})
export class RequestAccessSheetComponent implements OnInit {
  readonly cipherId = input.required<string>();
  /** Shown beside the sheet title. */
  readonly itemName = input<string>();
  readonly terms = input<RequestTerms | null>(null);

  /** The requester closed the sheet without sending anything. */
  readonly dismissed = output<void>();
  /** A request went through, or the server already holds one, so the caller re-reads access. */
  readonly accessChanged = output<void>();

  private readonly accessRequestSdkService = inject(AccessRequestSdkService);
  private readonly leasingErrorService = inject(LeasingErrorService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly logService = inject(LogService);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly locale = inject(LOCALE_ID);

  private readonly sheet = viewChild.required("sheet", { read: ElementRef<HTMLElement> });

  protected readonly badgeLook = ACCESS_BADGE_LOOK;

  /** `null` until the pre-check resolves the approval path. */
  protected readonly requestMode = signal<AccessApprovalMode | null>(null);
  protected readonly loadingRequestForm = signal(true);
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
   * Start picker floor, pinned when the sheet opened. Reactive forms ignore `min`, so
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
      const time = formatTimeOfDay(this.locale, new Date(`${date}T${value}`).getTime());
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
    // The sheet covers the button that opened it, which would otherwise keep focus.
    afterNextRender(() => this.sheet().nativeElement.focus());
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

    void this.loadRequestForm();
  }

  protected dismiss(): void {
    this.dismissed.emit();
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

  protected readonly copyReasonFromAutomatic = (): void =>
    this.copyReason(this.automaticForm.getRawValue().reason);

  protected readonly copyReasonFromHuman = (): void =>
    this.copyReason(this.humanForm.getRawValue().reason);

  // `[bitAction]` owns the busy state and serialises re-entrant clicks, so this only guards on form
  // validity.
  protected readonly submitRequest = async (): Promise<void> => {
    const mode = this.requestMode();
    if (mode == null) {
      return;
    }
    const form = mode === "automatic" ? this.automaticForm : this.humanForm;
    // `markAllAsTouched` does not re-run validators, so a sheet left open past its own seeded
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
        this.cipherId(),
        request,
      );
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t(
          result.approvalMode === "automatic"
            ? "requestAccessModalApprovedSuccessV2"
            : "requestAccessModalRequestCreatedSuccessV2",
        ),
      });
      this.emitAccessChanged();
    } catch (e) {
      this.handleRequestError(e);
    }
  };

  /** A lease that raced in hands back to the caller, whose re-read reveals it. */
  private async loadRequestForm(): Promise<void> {
    try {
      const preCheck = await this.accessRequestSdkService.preCheck(this.cipherId());
      if (preCheck.hasActiveLease) {
        this.emitAccessChanged();
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

  /** The caller may already have closed the sheet while a call was in flight. */
  private emitAccessChanged(): void {
    if (!this.destroyRef.destroyed) {
      this.accessChanged.emit();
    }
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

  /** A time alone on the reference instant's day, else the date and time. */
  private formatWindowPoint(date: Date, reference?: Date): string {
    if (reference != null && toDateInputValue(date) === toDateInputValue(reference)) {
      return formatTimeOfDay(this.locale, date.getTime());
    }
    return formatTimestamp(this.locale, date.getTime());
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

  /** Copies the reason as typed, for reuse in the next request. */
  private copyReason(value: string): void {
    if (value.length === 0) {
      return;
    }
    this.platformUtilsService.copyToClipboard(value);
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
   * An "already have this" rejection is not a failure: the sheet hands back and the re-read shows
   * the state that already exists.
   */
  private handleRequestError(e: unknown): void {
    const message =
      this.leasingErrorService.isLeasingError(e) || e instanceof Error ? e.message : undefined;
    const outcome = classifyRequestAccessError(
      message == null ? message : (apiErrorBodyMessage(message) ?? message),
    );

    switch (outcome.kind) {
      case "reconcile":
        this.toastService.showToast({
          variant: "info",
          message: this.i18nService.t(outcome.toastKey),
        });
        this.emitAccessChanged();
        return;
      case "inline":
        if (outcome.field === "reason") {
          this.humanForm.controls.reason.setErrors({ required: true });
        }
        this.requestError.set(outcome.serverMessage);
        return;
      case "refused":
        this.requestError.set(this.i18nService.t(outcome.messageKey));
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
