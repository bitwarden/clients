import { CommonModule } from "@angular/common";
import {
  AfterContentChecked,
  booleanAttribute,
  Component,
  computed,
  contentChild,
  contentChildren,
  input,
  Input,
  signal,
  viewChild,
} from "@angular/core";

import { I18nPipe } from "@bitwarden/ui-common";

import { BitHintDirective } from "../form-control/hint.directive";
import { BitLabelComponent } from "../form-control/label.component";

import { BitErrorComponent } from "./error.component";
import { BitFieldContainerDirective, FieldContainerSize } from "./field-container.directive";
import { BitFormFieldControl } from "./form-field-control";
import { BitPrefixDirective } from "./prefix.directive";
import { BitSuffixDirective } from "./suffix.directive";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-form-field",
  templateUrl: "./form-field.component.html",
  imports: [CommonModule, BitErrorComponent, BitFieldContainerDirective, I18nPipe],
  host: {
    "[class]": "classList",
    "(focusin)": "onFocusIn($event.target)",
    "(focusout)": "onFocusOut()",
  },
})
export class BitFormFieldComponent implements AfterContentChecked {
  readonly input = contentChild.required(BitFormFieldControl);
  readonly hint = contentChild(BitHintDirective);
  readonly label = contentChild(BitLabelComponent);

  readonly error = viewChild(BitErrorComponent);

  readonly disableMargin = input(false, { transform: booleanAttribute });

  readonly size = input<FieldContainerSize>("base");

  /** If `true`, remove the bottom border for `readonly` inputs */
  // TODO: Skipped for signal migration because:
  //  Your application code writes to the input. This prevents migration.
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input({ transform: booleanAttribute })
  disableReadOnlyBorder = false;

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

  /**
   * If the currently focused element is not part of the default content, then we don't want to show focus on the
   * input field itself.
   *
   * This is necessary because the `tw-group/bit-form-field` wraps the input and any prefix/suffix
   * buttons
   */
  protected readonly defaultContentIsFocused = signal(false);
  onFocusIn(target: HTMLElement) {
    this.defaultContentIsFocused.set(target.matches("[data-default-content] *:focus-visible"));
  }
  onFocusOut() {
    this.defaultContentIsFocused.set(false);
  }

  protected get readOnly(): boolean {
    return !!this.input().readOnly;
  }

  ngAfterContentChecked(): void {
    const error = this.error();
    const hint = this.hint();
    if (error) {
      this.input().ariaDescribedBy = error.id;
    } else if (hint) {
      this.input().ariaDescribedBy = hint.id;
    } else {
      this.input().ariaDescribedBy = undefined;
    }
  }
}
