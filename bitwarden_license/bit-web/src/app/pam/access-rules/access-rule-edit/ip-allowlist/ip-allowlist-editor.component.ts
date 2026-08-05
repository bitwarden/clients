import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, OnInit, inject, input } from "@angular/core";
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
import { CidrPredicate, cidrValidator } from "./cidr.validator";

/** A single CIDR row control, carrying the per-row {@link cidrValidator}. */
export type CidrRowControl = FormControl<string>;

/** The host-owned CIDR array this editor renders. Its array-level validators (duplicate /
 *  at-least-one) live on the host so validity flows through the parent form. */
export type IpAllowlistCidrsArray = FormArray<CidrRowControl>;

/**
 * Builds a CIDR row control with the per-row {@link cidrValidator} attached. `isValid` supplies
 * the CIDR check (see {@link CidrPredicate}) so callers can route it through
 * {@link CidrValidationService} rather than importing the WASM-backed check directly.
 */
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
 * Editor for the `ip_allowlist` access rule.
 *
 * Renders a repeatable list of CIDR inputs over a {@link FormArray} owned by the host form and
 * passed in via {@link cidrArray}. The host keeps value and validity on its own control — this
 * component only manages the row UI (add/remove) and surfaces the array's validation errors.
 * Empty rows stay in the value; the host trims and drops them when serialising the rule.
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
export class IpAllowlistEditorComponent implements OnInit {
  /** The host-owned CIDR array this editor renders and mutates. */
  readonly cidrArray = input.required<IpAllowlistCidrsArray>();

  /** Whether the form fields should be read-only. */
  readonly readonly = input<boolean>(false);

  private readonly i18n = inject(I18nService);
  private readonly cidrValidation = inject(CidrValidationService);

  ngOnInit(): void {
    // Start with a single blank row to type into when the host seeds no value.
    if (this.cidrArray().length === 0) {
      this.appendRow();
    }
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

  /** Surface the array-level errors (duplicate / at-least-one) once the user interacts. */
  protected markTouched(): void {
    this.cidrArray().markAsTouched();
  }

  private appendRow(value = ""): void {
    this.cidrArray().push(
      cidrRowControl(value, this.i18n.t("accessRuleIpAllowlistInvalidCidr"), (v) =>
        this.cidrValidation.isValid(v),
      ),
    );
  }
}
