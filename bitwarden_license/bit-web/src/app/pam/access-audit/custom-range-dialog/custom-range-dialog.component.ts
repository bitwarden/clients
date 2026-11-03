import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule, ValidatorFn } from "@angular/forms";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  AsyncActionsModule,
  ButtonModule,
  DIALOG_DATA,
  DialogConfig,
  DialogModule,
  DialogRef,
  DialogService,
  FormFieldModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import {
  AUDIT_HISTORY_DAYS,
  auditHistoryStart,
  auditRangeEnd,
  auditRangeStart,
  auditRangeValue,
} from "../access-audit-row";

/** `datetime-local` values; a blank bound leaves that side open. */
export type CustomRangeDialogParams = { from: string; to: string };

export type CustomRangeDialogResult =
  { action: "apply"; from: string; to: string } | { action: "clear" };

const MINUTE_MS = 60 * 1000;

/**
 * Collects the custom bounds behind the audit log's Time period filter, so the toolbar stays chips
 * alone. Cancel closes with an explicit `undefined`, so a bare `bitDialogClose` can't pass for a
 * result.
 */
@Component({
  selector: "pam-custom-range-dialog",
  templateUrl: "./custom-range-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncActionsModule,
    ButtonModule,
    DialogModule,
    FormFieldModule,
    ReactiveFormsModule,
    I18nPipe,
  ],
})
export class CustomRangeDialogComponent {
  private readonly dialogRef = inject<DialogRef<CustomRangeDialogResult | undefined>>(DialogRef);
  private readonly formBuilder = inject(FormBuilder);
  private readonly i18nService = inject(I18nService);
  private readonly params = inject<CustomRangeDialogParams>(DIALOG_DATA);
  private readonly fromField = viewChild<ElementRef<HTMLInputElement>>("fromField");

  protected readonly formGroup = this.formBuilder.nonNullable.group({
    from: [this.params.from],
    to: [this.params.to],
  });

  private readonly fromValue = toSignal(this.formGroup.controls.from.valueChanges, {
    initialValue: this.params.from,
  });
  private readonly toValue = toSignal(this.formGroup.controls.to.valueChanges, {
    initialValue: this.params.to,
  });

  /** From after To. Surfaced, since an empty table would otherwise read as no events. */
  protected readonly invertedRange = computed(() => {
    const start = auditRangeStart(this.fromValue());
    const end = auditRangeEnd(this.toValue());
    return start != null && end != null && end.getTime() < start.getTime();
  });

  /** Set on the To control, so `bit-form-field` renders its usual error state and message. */
  private readonly invertedRangeValidator: ValidatorFn = () =>
    this.invertedRange()
      ? { invalidDateRange: { message: this.i18nService.t("invalidDateRange") } }
      : null;

  /** Both blank means no custom range, which Save must not apply. */
  private readonly bounded = computed(
    () => auditRangeStart(this.fromValue()) != null || auditRangeEnd(this.toValue()) != null,
  );

  /** Read once, when the dialog opens. */
  private readonly nowMs = signal(Date.now());

  /** The server refuses a span wider than its history window rather than reading part of it. */
  private readonly historyStart = computed(() => auditHistoryStart(new Date(this.nowMs())));

  /** The first whole minute in the window, so the pickers grey out what the server can't read. */
  protected readonly earliestValue = computed(() =>
    auditRangeValue(new Date(Math.ceil(this.historyStart().getTime() / MINUTE_MS) * MINUTE_MS)),
  );

  private readonly fromBeforeHistory = computed(() =>
    this.beforeHistory(auditRangeStart(this.fromValue())),
  );
  private readonly toBeforeHistory = computed(() =>
    this.beforeHistory(auditRangeEnd(this.toValue())),
  );

  protected readonly confirmDisabled = computed(
    () =>
      this.invertedRange() || this.fromBeforeHistory() || this.toBeforeHistory() || !this.bounded(),
  );

  constructor() {
    afterNextRender(() => this.fromField()?.nativeElement.focus());

    this.formGroup.controls.from.addValidators(this.beforeHistoryValidator(this.fromBeforeHistory));
    this.formGroup.controls.to.addValidators([
      this.invertedRangeValidator,
      this.beforeHistoryValidator(this.toBeforeHistory),
    ]);

    // Marked touched on every invalid edit, since `BitInputDirective` untouches on each keystroke
    // and an untouched control shows no error.
    effect(() => {
      this.fromValue();
      this.toValue();
      this.formGroup.controls.from.updateValueAndValidity();
      this.formGroup.controls.to.updateValueAndValidity();
      if (this.fromBeforeHistory()) {
        this.formGroup.controls.from.markAsTouched();
      }
      if (this.invertedRange() || this.toBeforeHistory()) {
        this.formGroup.controls.to.markAsTouched();
      }
    });
  }

  private beforeHistory(bound: Date | null): boolean {
    return bound != null && bound < this.historyStart();
  }

  private beforeHistoryValidator(beforeHistory: () => boolean): ValidatorFn {
    return () =>
      beforeHistory()
        ? {
            beforeAuditHistory: {
              message: this.i18nService.t("pamAuditRangeOutsideHistory", AUDIT_HISTORY_DAYS),
            },
          }
        : null;
  }

  protected readonly confirm = async (): Promise<void> => {
    if (this.confirmDisabled()) {
      return;
    }
    const { from, to } = this.formGroup.getRawValue();
    void this.dialogRef.close({ action: "apply", from: from.trim(), to: to.trim() });
  };

  protected clear(): void {
    void this.dialogRef.close({ action: "clear" });
  }

  static open(
    dialogService: DialogService,
    config: DialogConfig<CustomRangeDialogParams>,
  ): DialogRef<CustomRangeDialogResult | undefined> {
    return dialogService.open<CustomRangeDialogResult | undefined, CustomRangeDialogParams>(
      CustomRangeDialogComponent,
      config,
    );
  }
}
