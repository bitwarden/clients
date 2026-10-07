import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, DoCheck, OnInit, inject, input } from "@angular/core";
import { FormArray, FormControl, ReactiveFormsModule } from "@angular/forms";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  AsyncActionsModule,
  ButtonModule,
  FormFieldModule,
  IconButtonModule,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { CidrValidationService } from "./cidr-validation.service";
import { CidrPredicate, cidrValidator, duplicateCidrValues } from "./cidr.validator";

export type CidrRowControl = FormControl<string>;

/** Owned by the host, whose array-level validators keep validity in the parent form. */
export type IpAllowlistCidrsArray = FormArray<CidrRowControl>;

export function cidrRowControl(
  value: string,
  invalidCidrMessage: string,
  isValid: CidrPredicate,
): CidrRowControl {
  return new FormControl(value, {
    nonNullable: true,
    validators: [cidrValidator(invalidCidrMessage, isValid)],
  });
}

/**
 * Row UI for the `ip_allowlist` condition over the host's array. Empty rows stay in the value; the
 * host drops them when serializing.
 */
@Component({
  selector: "app-pam-ip-allowlist-editor",
  templateUrl: "./ip-allowlist-editor.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    I18nPipe,
    AsyncActionsModule,
    ButtonModule,
    FormFieldModule,
    TypographyModule,
    IconButtonModule,
  ],
})
export class IpAllowlistEditorComponent implements OnInit, DoCheck {
  readonly cidrArray = input.required<IpAllowlistCidrsArray>();

  readonly readonly = input<boolean>(false);

  private readonly i18n = inject(I18nService);
  private readonly cidrValidation = inject(CidrValidationService);

  ngOnInit(): void {
    if (this.cidrArray().length === 0) {
      this.appendRow();
    }
  }

  /**
   * The host can re-run the array's validators with `emitEvent: false`, so no change event fires.
   * {@link syncDuplicateErrors} writes nothing once the row marks are in step.
   */
  ngDoCheck(): void {
    this.syncDuplicateErrors();
  }

  protected addRow(): void {
    this.appendRow();
    this.markTouched();
  }

  protected removeRow(index: number): void {
    const array = this.cidrArray();
    array.removeAt(index);
    // Keep at least one row so the user always has an input to type into.
    if (array.length === 0) {
      this.appendRow();
    }
    this.markTouched();
  }

  /** Surfaces the array-level at-least-one error once the user interacts. */
  protected markTouched(): void {
    this.cidrArray().markAsTouched();
  }

  /**
   * Marks each repeated row so `bit-form-field` shows the error under it. `invalidCidr` stays
   * first, so a malformed repeated row shows the format error.
   */
  private syncDuplicateErrors(): void {
    const controls = this.cidrArray().controls;
    const values = controls.map((control) => control.value.trim());
    const duplicated = duplicateCidrValues(values);

    const message = this.i18n.t("accessRuleIpAllowlistDuplicateCidr");
    controls.forEach((control, index) => {
      const isDuplicate = duplicated.has(values[index]);
      if (isDuplicate === control.hasError("duplicateCidr")) {
        return;
      }
      if (isDuplicate) {
        control.setErrors({ ...control.errors, duplicateCidr: { message } });
        control.markAsTouched();
      } else {
        const rest = { ...control.errors };
        delete rest.duplicateCidr;
        control.setErrors(Object.keys(rest).length > 0 ? rest : null);
      }
    });
  }

  private appendRow(value = ""): void {
    this.cidrArray().push(
      cidrRowControl(value, this.i18n.t("accessRuleIpAllowlistInvalidCidr"), (v) =>
        this.cidrValidation.isValid(v),
      ),
    );
  }
}
