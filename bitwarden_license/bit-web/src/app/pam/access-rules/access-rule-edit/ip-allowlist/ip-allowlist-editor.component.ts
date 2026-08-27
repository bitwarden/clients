import { CommonModule } from "@angular/common";
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  input,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
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
export class IpAllowlistEditorComponent implements OnInit, AfterViewInit {
  /** The host-owned CIDR array this editor renders and mutates. */
  readonly cidrArray = input.required<IpAllowlistCidrsArray>();

  /** Whether the form fields should be read-only. */
  readonly readonly = input<boolean>(false);

  private readonly i18n = inject(I18nService);
  private readonly cidrValidation = inject(CidrValidationService);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    // Start with a single blank row to type into when the host seeds no value.
    if (this.cidrArray().length === 0) {
      this.appendRow();
    }

    this.cidrArray()
      .valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.syncDuplicateErrors());
  }

  ngAfterViewInit(): void {
    // Not ngOnInit: each row's `[formControl]` directive revalidates its control as its binding
    // initialises, replacing `control.errors` wholesale and wiping any mark set earlier. Not
    // valueChanges alone either: the host seeds an existing rule's rows with `{ emitEvent: false }`
    // (`AccessRuleEditComponent.setIpAllowlistCidrs`), so nothing is emitted on load.
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

  /** Surface the array-level errors (duplicate / at-least-one) once the user interacts. */
  protected markTouched(): void {
    this.cidrArray().markAsTouched();
  }

  /**
   * Marks every row whose trimmed value is shared with another row, so `bit-form-field` renders
   * `accessRuleIpAllowlistDuplicateCidr` through `bit-error` under each offending row — the same
   * mechanism {@link cidrValidator} already gets for `invalidCidr`. A row can be both malformed and
   * repeated; `invalidCidr` stays first in insertion order so the format error is what shows.
   *
   * Marking the row touched is part of the contract, not a nicety:
   * `BitFormFieldControlDirective.hasError` gates on the row's own `touched`, and neither an
   * untouched initial load nor a blur on one row of a pair ever sets it on the partner row.
   */
  private syncDuplicateErrors(): void {
    const controls = this.cidrArray().controls;
    const values = controls.map((control) => control.value.trim());

    const seen = new Set<string>();
    const duplicated = new Set<string>();
    for (const value of values) {
      if (value === "") {
        continue;
      }
      if (seen.has(value)) {
        duplicated.add(value);
      }
      seen.add(value);
    }

    const message = this.i18n.t("accessRuleIpAllowlistDuplicateCidr");
    controls.forEach((control, index) => {
      const isDuplicate = duplicated.has(values[index]);
      // Every `setErrors` revalidates the whole array through its ancestors, so only write to the
      // rows whose mark actually changes.
      if (isDuplicate === control.hasError("duplicateCidr")) {
        return;
      }
      if (isDuplicate) {
        // No `{ emitEvent: false }` on either call: `hasError` only recomputes on a
        // StatusChangeEvent / TouchedChangeEvent, so suppressing them would change the errors
        // without rendering them.
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
