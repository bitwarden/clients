import { CommonModule } from "@angular/common";
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  effect,
  input,
  contentChild,
  viewChild,
} from "@angular/core";

import { I18nPipe } from "@bitwarden/ui-common";

import { BitHintDirective } from "../form-control/hint.directive";
import { BitLabelComponent } from "../form-control/label.component";

import { BitErrorComponent } from "./error.component";
import { BitFieldContainerDirective, FieldContainerSize } from "./field-container.directive";
import { BitFormFieldControlDirective } from "./form-field-control.directive";
import { BitPrefixDirective } from "./prefix.directive";
import { BitSuffixDirective } from "./suffix.directive";

@Component({
  selector: "bit-form-field",
  templateUrl: "./form-field.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, BitErrorComponent, BitFieldContainerDirective, I18nPipe],
  host: {
    "[class]": "classList",
  },
})
export class BitFormFieldComponent {
  /**
   * The projected form control directive (`bitInput`, `bitSelect`, etc.).
   *
   * Optional so that wrapper components (e.g. `bit-file-input`, `bit-file-dropzone`) can compose
   * `bit-form-field` for its label / hint / error chrome while owning their own control and
   * laying out a custom input. In that mode the wrapper supplies `labelForId` / `required` /
   * `hasError` / `error` as inputs, and the field-container chrome is not rendered.
   */
  readonly input = contentChild(BitFormFieldControlDirective);
  readonly hint = contentChild(BitHintDirective);
  readonly label = contentChild(BitLabelComponent);

  readonly errorComponent = viewChild(BitErrorComponent);

  readonly disableMargin = input(false, { transform: booleanAttribute });

  readonly size = input<FieldContainerSize>("base");

  /**
   * State supplied by wrapper components that don't project a `BitFormFieldControlDirective`.
   * Ignored when a control directive is present — the directive is the source of truth.
   */
  readonly labelForId = input<string>();
  readonly required = input<boolean>();
  readonly hasError = input<boolean>();
  readonly error = input<[string, any]>();

  private readonly prefixChildren = contentChildren(BitPrefixDirective);
  private readonly suffixChildren = contentChildren(BitSuffixDirective);

  protected readonly prefixHasChildren = computed(() => this.prefixChildren().length > 0);
  protected readonly suffixHasChildren = computed(() => this.suffixChildren().length > 0);

  /** Whether a projected control directive drives the field (standard usage). */
  protected readonly hasControl = computed(() => this.input() != null);

  protected readonly resolvedLabelForId = computed(
    () => this.input()?.labelForId() ?? this.labelForId() ?? "",
  );
  protected readonly resolvedRequired = computed(
    () => this.input()?.required() ?? this.required() ?? false,
  );
  protected readonly resolvedHasError = computed(
    () => this.input()?.hasError() ?? this.hasError() ?? false,
  );
  protected readonly resolvedError = computed<[string, any] | undefined>(
    () => this.input()?.error ?? this.error(),
  );

  /**
   * Id of the element describing the control (error takes precedence over hint). Wrapper
   * components read this to wire `aria-describedby` on their own focusable input.
   */
  readonly describedById = computed<string | undefined>(() => {
    if (this.resolvedHasError()) {
      return this.errorComponent()?.id;
    }
    return this.hint()?.id;
  });

  protected get labelAndFieldContainerClasses(): string {
    return [
      "tw-flex",
      "tw-flex-col",
      "has-[input:disabled]:!tw-text-fg-inactive",
      "[&_bit-hint]:tw-m-0",
      "[&_bit-error]:tw-m-0",
      ...(this.readOnly ? [] : ["tw-gap-2"]),
    ].join(" ");
  }

  protected get contentContainerClasses(): string {
    return [
      "tw-size-full",
      "tw-min-w-0",
      "tw-relative",
      "[&>*]:tw-p-0",
      "[&>*::selection]:tw-bg-bg-brand-medium",
      "[&>*::selection]:tw-text-fg-heading",
      "has-[bit-select]:tw-p-0",
      "has-[bit-multi-select]:tw-p-0",
      "has-[textarea]:tw-pe-0",
      "has-[textarea]:!tw-py-3",
      ...(this.readOnly ? [] : ["tw-px-3"]),
    ].join(" ");
  }

  get classList() {
    return ["tw-block"].concat(this.disableMargin() ? [] : ["tw-mb-4", "bit-compact:tw-mb-3"]);
  }

  protected get readOnly(): boolean {
    return !!this.input()?.readOnly();
  }

  constructor() {
    // Wire the projected control's aria-describedby to the rendered error/hint. Wrapper
    // components (no projected control) read `describedById` directly instead.
    effect(() => {
      this.input()?.ariaDescribedBy.set(this.describedById());
    });
  }
}
