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
 * What the auditor asked for. Tagged rather than shaped, because "no range at all" and "a range with
 * both ends blank" reach the caller as different intents: the first drops the Custom selection, the
 * second is not offerable at all — Save is disabled until at least one end is set.
 */
export type CustomRangeDialogResult =
  { action: "apply"; from: string; to: string } | { action: "clear" };

/**
 * Collects the custom bounds behind the audit log's Time period filter.
 *
 * The two `datetime-local` fields live here rather than in the toolbar so the toolbar is chips alone:
 * a labelled 40px field beside a 28px chip left the row ragged, and a long chip label wrapped the row
 * and orphaned the buttons at the end of it.
 *
 * Opened with the bounds currently in force, so reopening shows what the table is already filtered to.
 * Only an explicit confirm produces a result; every other way out — Cancel, Escape, the backdrop — closes
 * with `undefined`, which leaves the caller's previous selection alone, because a cancelled dialog must not
 * strand the chip reading "Custom" over no range at all. Cancel binds that `undefined` explicitly: a bare
 * `bitDialogClose` attribute closes with the empty string, which a caller checking for a result would take
 * for one.
 *
 * Clear is the way out of a custom range from inside the dialog — without it an auditor who opened it to
 * widen the trail would have to cancel and clear the chip from the row behind.
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

  /** From after To. Surfaced to the auditor, who otherwise reads an empty table as a trail with no events. */
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

    // Editing From leaves To's value alone, so nothing else would re-run a cross-field rule. The control
    // is marked touched on every inverted edit rather than only when the range flips, because
    // `BitInputDirective.onInput` marks it untouched on each keystroke and
    // `BitFormFieldControlDirective.hasError` paints nothing on an untouched control — the message would
    // otherwise blink out mid-edit and stay hidden until the next blur.
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
