import { DatePipe } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  LOCALE_ID,
  OnInit,
  computed,
  inject,
  signal,
} from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { merge } from "rxjs";

import {
  type AccessApprovalMode,
  AccessRefreshService,
  type AccessRequestCreateRequest,
  AccessRequestSdkService,
  DEFAULT_REQUEST_ACCESS_DURATION_SECONDS,
  LeasingErrorService,
  REQUEST_ACCESS_DURATION_PRESETS,
  type RequestDurationOption,
  type RequestWindowProblem,
  apiErrorBodyMessage,
  classifyRequestAccessError,
  composeRequestWindow,
  defaultRequestWindow,
  midnightCrossingEnd,
  requestDurationOptions,
  toDateInputValue,
} from "@bitwarden/bit-common/pam";
import { DurationShortPipe } from "@bitwarden/bit-common/pam/date/duration-short.pipe";
import { formatDuration } from "@bitwarden/bit-common/pam/date/format-duration";
import {
  REQUEST_WINDOW_ERROR_KEY,
  requestWindowEndValidator,
} from "@bitwarden/bit-common/pam/helpers/request-access-window.validators";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  AsyncActionsModule,
  ButtonModule,
  DIALOG_DATA,
  DialogModule,
  DialogRef,
  DialogService,
  FormFieldModule,
  IconModule,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

export type RequestAccessDialogParams = {
  /** The gated cipher access is requested for. */
  cipherId: string;
  /** The item's name, shown under the dialog title. */
  itemName: string;
};

/**
 * How the dialog closed. `submitted`: a request now exists. `reconciled`: the caller already held
 * what they asked for. `undefined`: dismissed with nothing sent.
 */
export type RequestAccessDialogResult = "submitted" | "reconciled";

/**
 * Requests access to one gated cipher. Pre-checks the governing rule to pick the approval path,
 * submits, and announces the change through {@link AccessRefreshService} before closing with
 * anything but `undefined`.
 */
@Component({
  selector: "app-pam-request-access-dialog",
  templateUrl: "./request-access-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncActionsModule,
    ButtonModule,
    DialogModule,
    FormFieldModule,
    IconModule,
    ReactiveFormsModule,
    TypographyModule,
    DatePipe,
    DurationShortPipe,
    I18nPipe,
  ],
})
export class RequestAccessDialogComponent implements OnInit {
  private readonly dialogRef = inject<DialogRef<RequestAccessDialogResult | undefined>>(DialogRef);
  protected readonly params = inject<RequestAccessDialogParams>(DIALOG_DATA);
  private readonly accessRequestSdkService = inject(AccessRequestSdkService);
  private readonly accessRefreshService = inject(AccessRefreshService);
  private readonly leasingErrorService = inject(LeasingErrorService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly logService = inject(LogService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly locale = inject(LOCALE_ID);

  /** Approval path resolved by the pre-check; `null` until it lands. */
  protected readonly requestMode = signal<AccessApprovalMode | null>(null);
  protected readonly loading = signal(true);
  protected readonly requestError = signal<string | null>(null);

  /** The governing rule's duration bounds from the pre-check; `null` until it lands. */
  private readonly requestBounds = signal<{ defaultSeconds: number; maxSeconds: number } | null>(
    null,
  );

  /**
   * The requester's duration choices for the resolved rule, narrowed to its cap. Falls back to the
   * unnarrowed presets before the pre-check lands, which is only ever transient: no form renders
   * until `requestMode` is set, and that happens with the bounds.
   */
  protected readonly durationOptions = computed<readonly RequestDurationOption[]>(() => {
    const bounds = this.requestBounds();
    return bounds == null
      ? REQUEST_ACCESS_DURATION_PRESETS
      : requestDurationOptions(bounds.maxSeconds, bounds.defaultSeconds);
  });

  /** The cap the human path's window must fit inside, for the message under the time fields. */
  protected readonly maxWindowSeconds = computed(() => this.requestBounds()?.maxSeconds ?? null);

  /**
   * Floor for the human path's date picker, pinned when the pre-check landed.
   *
   * An affordance only — reactive forms don't read `min`, so `requestWindowEndValidator` is the
   * real check.
   */
  protected readonly minRequestDate = signal("");

  /** `freesAt` for a held single-active-access slot; `null` when the slot is free or unknown. */
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

  /** The human form's live values, so the next-day hint recomputes on every edit. */
  private readonly humanFormValue = toSignal(this.humanForm.valueChanges, {
    initialValue: this.humanForm.value,
  });

  /** The end instant when the requested window crosses midnight, `null` otherwise. */
  protected readonly nextDayEnd = computed(() => midnightCrossingEnd(this.humanFormValue()));

  ngOnInit(): void {
    // Subscribed to the sibling controls, not the group, to avoid re-entrant validation.
    const { date, start, end } = this.humanForm.controls;
    merge(date.valueChanges, start.valueChanges)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        end.updateValueAndValidity();
        // Only a window error; marking a blank End touched would race `BitInputDirective.onInput`.
        if (end.errors?.[REQUEST_WINDOW_ERROR_KEY] != null) {
          end.markAsTouched();
        }
      });

    void this.loadPreCheck();
  }

  /**
   * Resolves the approval path with a side-effect-free pre-check so the form is purely inputs plus
   * submit. A pre-check that reports an active lease means one raced in: close as reconciled.
   */
  private async loadPreCheck(): Promise<void> {
    try {
      const preCheck = await this.accessRequestSdkService.preCheck(this.params.cipherId);
      if (preCheck.hasActiveLease) {
        this.close("reconciled");
        return;
      }

      // The rule's bounds, read before either form is seeded: both the picker and the default
      // window are built from them.
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
        // `canStartLease` answers about now, and this window is in the future, so a slot taken
        // right now does not warrant a contention warning.
      } else {
        // `requestDurationOptions` always includes the rule's default.
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
      this.loading.set(false);
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

  // `[bitAction]` owns the button's busy state and serialises re-entrant clicks, so this only has
  // to guard on form validity.
  protected readonly submit = async (): Promise<void> => {
    const mode = this.requestMode();
    if (mode == null) {
      return;
    }
    const form = mode === "automatic" ? this.automaticForm : this.humanForm;
    // `markAllAsTouched` does not re-run validators, so a dialog left open past its own seeded
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
        this.params.cipherId,
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
      this.close("submitted");
    } catch (e) {
      this.handleRequestError(e);
    }
  };

  private close(result: RequestAccessDialogResult): void {
    this.accessRefreshService.notifyAccessChanged(this.params.cipherId);
    void this.dialogRef.close(result);
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
   * Reconciles a rejected submit. An "already have this" rejection is not a failure: close as
   * reconciled and let the re-read settle every surface into the state that already exists.
   */
  private handleRequestError(e: unknown): void {
    // A `LeasingError` is a flat wasm-bindgen shape, not an `Error`, so both guards are needed.
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
        this.close("reconciled");
        return;
      case "inline":
        if (outcome.field === "reason") {
          this.humanForm.controls.reason.setErrors({ required: true });
        }
        this.requestError.set(outcome.serverMessage);
        return;
      case "exceedsMax":
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

  static open(
    dialogService: DialogService,
    params: RequestAccessDialogParams,
  ): DialogRef<RequestAccessDialogResult | undefined, RequestAccessDialogComponent> {
    return dialogService.open<
      RequestAccessDialogResult | undefined,
      RequestAccessDialogParams,
      RequestAccessDialogComponent
    >(RequestAccessDialogComponent, { data: params });
  }
}

/** Rejects a control whose value is only whitespace — the server requires a non-empty reason. */
function nonBlank(control: { value: unknown }): { required: true } | null {
  return typeof control.value === "string" && control.value.trim().length > 0
    ? null
    : { required: true };
}
