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

/** A custom audit range as `datetime-local` values; a blank bound is unbounded on that side. */
export type CustomRangeDialogParams = { from: string; to: string };

/**
 * What the auditor asked for. Tagged, not shaped, since "no range" and "both ends blank" are
 * different intents — the first drops the selection, the second isn't offerable at all.
 */
export type CustomRangeDialogResult =
  { action: "apply"; from: string; to: string } | { action: "clear" };

/**
 * Collects the custom bounds behind the audit log's Time period filter.
 *
 * The two `datetime-local` fields live here, not in the toolbar, so the toolbar stays chips
 * alone — a labelled field beside a chip left the row ragged and orphaned the buttons.
 *
 * Opens with the bounds currently in force; only an explicit confirm produces a result, and
 * Cancel explicitly closes with `undefined` so a bare `bitDialogClose` can't be mistaken for one.
 *
 * Clear is the way out of a custom range from inside the dialog.
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

  /** From after To; surfaced to the auditor, who otherwise reads an empty table as no events. */
  protected readonly invertedRange = computed(() => {
    const start = auditRangeStart(this.fromValue());
    const end = auditRangeEnd(this.toValue());
    return start != null && end != null && end.getTime() < start.getTime();
  });

  /**
   * The inverted range as the To control's own error, so the field carries the danger border,
   * `aria-invalid` and the message that `bit-form-field` already renders for a control in error.
   */
  private readonly invertedRangeValidator: ValidatorFn = () =>
    this.invertedRange()
      ? { invalidDateRange: { message: this.i18nService.t("invalidDateRange") } }
      : null;

  /** Whether either end is set. Both blank is the same as no custom range, which Save must not apply. */
  private readonly bounded = computed(
    () => auditRangeStart(this.fromValue()) != null || auditRangeEnd(this.toValue()) != null,
  );

  protected readonly confirmDisabled = computed(() => this.invertedRange() || !this.bounded());

  constructor() {
    afterNextRender(() => this.fromField()?.nativeElement.focus());

    this.formGroup.controls.to.addValidators(this.invertedRangeValidator);

    // Marked touched on every inverted edit, not just when the range flips: `BitInputDirective`
    // untouches on each keystroke, and an untouched control paints no error — the message would
    // otherwise blink out mid-edit.
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
