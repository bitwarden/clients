import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
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

import { auditRangeEnd, auditRangeStart } from "../access-audit-row";

/** `datetime-local` values; a blank bound leaves that side open. */
export type CustomRangeDialogParams = { from: string; to: string };

export type CustomRangeDialogResult =
  { action: "apply"; from: string; to: string } | { action: "clear" };

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

  protected readonly confirmDisabled = computed(() => this.invertedRange() || !this.bounded());

  constructor() {
    afterNextRender(() => this.fromField()?.nativeElement.focus());

    this.formGroup.controls.to.addValidators(this.invertedRangeValidator);

    // Marked touched on every inverted edit, since `BitInputDirective` untouches on each keystroke
    // and an untouched control shows no error.
    effect(() => {
      this.fromValue();
      this.toValue();
      this.formGroup.controls.to.updateValueAndValidity();
      if (this.invertedRange()) {
        this.formGroup.controls.to.markAsTouched();
      }
    });
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
