import { CommonModule } from "@angular/common";
import {
  AfterContentChecked,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
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
export class BitFormFieldComponent implements AfterContentChecked {
  readonly input = contentChild.required(BitFormFieldControlDirective);
  readonly hint = contentChild(BitHintDirective);
  readonly label = contentChild(BitLabelComponent);

  readonly error = viewChild(BitErrorComponent);

  readonly disableMargin = input(false, { transform: booleanAttribute });

  readonly size = input<FieldContainerSize>("base");

  private readonly prefixChildren = contentChildren(BitPrefixDirective);
  private readonly suffixChildren = contentChildren(BitSuffixDirective);

  protected readonly prefixHasChildren = computed(() => this.prefixChildren().length > 0);
  protected readonly suffixHasChildren = computed(() => this.suffixChildren().length > 0);

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
    return !!this.input().readOnly();
  }

  ngAfterContentChecked(): void {
    const error = this.error();
    const hint = this.hint();
    if (error) {
      this.input().ariaDescribedBy.set(error.id);
    } else if (hint) {
      this.input().ariaDescribedBy.set(hint.id);
    } else {
      this.input().ariaDescribedBy.set(undefined);
    }
  }
}
