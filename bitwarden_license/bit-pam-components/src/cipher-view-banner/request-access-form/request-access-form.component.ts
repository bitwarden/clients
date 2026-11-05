import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
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
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";

import {
  type AccessApprovalMode,
  type AccessRequestCreateRequest,
  AccessRequestSdkService,
  apiErrorBodyMessage,
  LeasingErrorService,
  DEFAULT_REQUEST_ACCESS_DURATION_SECONDS,
  REQUEST_ACCESS_DURATION_PRESETS,
  type RequestDurationOption,
  requestDurationOptions,
  classifyRequestAccessError,
  type RequestWindowFormValue,
  composeRequestWindow,
  defaultRequestWindow,
} from "@bitwarden/bit-pam";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  AsyncActionsModule,
  FormFieldModule,
  IconButtonModule,
  IconModule,
  SkeletonComponent,
  SkeletonTextComponent,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { DurationLongPipe } from "../../date/duration-long.pipe";
import { TimestampPipe } from "../../date/timestamp.pipe";
import { requestTerms } from "../request-terms";
import { requestWindowProblemMessage } from "../request-window-fields/request-access-window.validators";
import { RequestWindowFieldsComponent } from "../request-window-fields/request-window-fields.component";

/**
 * The form a requester fills in to ask for access to a governed item. Each mount resolves the
 * approval path with a side-effect-free pre-check and shapes the form from it. The host renders
 * Send request and Cancel, since the sheet pins them to its footer.
 */
@Component({
  selector: "app-pam-request-access-form",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./request-access-form.component.html",
  host: { class: "tw-flex tw-flex-col tw-gap-4" },
  imports: [
    AsyncActionsModule,
    FormFieldModule,
    IconButtonModule,
    IconModule,
    ReactiveFormsModule,
    SkeletonComponent,
    SkeletonTextComponent,
    TypographyModule,
    DurationLongPipe,
    I18nPipe,
    RequestWindowFieldsComponent,
    TimestampPipe,
  ],
})
export class RequestAccessFormComponent implements OnInit {
  readonly cipherId = input.required<string>();

  /** A request went through, or the server already holds one, so the host re-reads access. */
  readonly accessChanged = output<void>();

  private readonly accessRequestSdkService = inject(AccessRequestSdkService);
  private readonly leasingErrorService = inject(LeasingErrorService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly logService = inject(LogService);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly locale = inject(LOCALE_ID);

  private readonly windowFields = viewChild(RequestWindowFieldsComponent);

  /** `null` until the pre-check resolves the approval path; the host offers Send request once set. */
  readonly requestMode = signal<AccessApprovalMode | null>(null);
  /** `true` until the pre-check returns. */
  readonly loadingRequestForm = signal(true);
  protected readonly requestError = signal<string | null>(null);

  /**
   * The governing rule's bounds from the pre-check. Both paths read the cap here, so the picker and
   * the window validator only offer what submit accepts.
   */
  private readonly requestBounds = signal<{ defaultSeconds: number; maxSeconds: number } | null>(
    null,
  );

  /** The rule's cap for the host's summary, from the same pre-check that shapes the form. */
  readonly terms = computed(() => {
    const approvalMode = this.requestMode();
    const bounds = this.requestBounds();
    return approvalMode == null || bounds == null
      ? null
      : requestTerms({ approvalMode, maxDurationSeconds: bounds.maxSeconds });
  });

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

  protected readonly defaultSeconds = computed(
    () => this.requestBounds()?.defaultSeconds ?? DEFAULT_REQUEST_ACCESS_DURATION_SECONDS,
  );

  /** The human path's window cap, for the message under the time fields. */
  protected readonly maxWindowSeconds = computed(() => this.requestBounds()?.maxSeconds ?? null);

  /** One clock reading for the window's seed and its pickers' floor. */
  protected readonly requestOpenedAt = signal(new Date());

  /**
   * Set while another member holds the single-active-lease slot. `null` treats free, unknown and
   * unsupported alike.
   */
  protected readonly slotContention = signal<{ freesAt: string | null } | null>(null);

  protected readonly automaticForm = this.formBuilder.nonNullable.group({
    durationSeconds: [DEFAULT_REQUEST_ACCESS_DURATION_SECONDS, Validators.required],
    reason: [""],
  });

  protected readonly humanForm = this.formBuilder.group({
    window: this.formBuilder.control<RequestWindowFormValue | null>(null),
    reason: this.formBuilder.nonNullable.control("", [Validators.required, nonBlank]),
  });

  ngOnInit(): void {
    void this.loadRequestForm();
  }

  protected readonly copyReasonFromAutomatic = (): void =>
    this.copyReason(this.automaticForm.getRawValue().reason);

  protected readonly copyReasonFromHuman = (): void =>
    this.copyReason(this.humanForm.getRawValue().reason);

  // `[bitAction]` owns the busy state and serialises re-entrant clicks, so this only guards on form
  // validity.
  readonly submitRequest = async (): Promise<void> => {
    const mode = this.requestMode();
    if (mode == null) {
      return;
    }
    const form = mode === "automatic" ? this.automaticForm : this.humanForm;
    // `markAllAsTouched` does not re-run validators, so a sheet left open past its own seeded
    // window still carries a stale verdict; re-validate before trusting `form.invalid`.
    if (mode === "human") {
      this.humanForm.controls.window.updateValueAndValidity();
      this.windowFields()?.markAllAsTouched();
    }
    form.markAllAsTouched();
    if (form.invalid) {
      this.scrollToFirstError();
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
        const openedAt = new Date();
        this.requestOpenedAt.set(openedAt);
        this.humanForm.patchValue({
          window: defaultRequestWindow(openedAt, bounds.defaultSeconds),
        });
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

  /** The host may already have closed the form while a call was in flight. */
  private emitAccessChanged(): void {
    if (!this.destroyRef.destroyed) {
      this.accessChanged.emit();
    }
  }

  /** A short window, such as the extension popup, can leave a field's error below the fold. */
  private scrollToFirstError(): void {
    afterNextRender(
      () =>
        this.host.nativeElement
          .querySelector('[aria-invalid="true"]')
          ?.closest("bit-form-field")
          ?.scrollIntoView({ block: "nearest" }),
      { injector: this.injector },
    );
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
    const { window: requested, reason } = this.humanForm.getRawValue();
    const window = requested == null ? null : composeRequestWindow(requested);
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
            ? requestWindowProblemMessage(
                this.i18nService,
                this.locale,
                "exceedsMaxWindow",
                outcome.maxSeconds,
              )
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
