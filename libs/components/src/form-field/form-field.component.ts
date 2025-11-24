import { CommonModule } from "@angular/common";
import {
  AfterContentChecked,
  booleanAttribute,
  Component,
  ElementRef,
  HostBinding,
  HostListener,
  signal,
  input,
  Input,
  contentChild,
  viewChild,
} from "@angular/core";

import { I18nPipe } from "@bitwarden/ui-common";

import { BitHintDirective } from "../form-control/hint.directive";
import { BitLabelComponent } from "../form-control/label.component";
import { inputBorderClasses } from "../input/input.directive";

import { BitErrorComponent } from "./error.component";
import { BitFormFieldControl } from "./form-field-control";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-form-field",
  templateUrl: "./form-field.component.html",
  imports: [CommonModule, BitErrorComponent, I18nPipe],
})
export class BitFormFieldComponent implements AfterContentChecked {
  readonly input = contentChild.required(BitFormFieldControl);
  readonly hint = contentChild(BitHintDirective);
  readonly label = contentChild(BitLabelComponent);

  readonly prefixContainer = viewChild<ElementRef<HTMLDivElement>>("prefixContainer");
  readonly suffixContainer = viewChild<ElementRef<HTMLDivElement>>("suffixContainer");

  readonly error = viewChild(BitErrorComponent);

  readonly disableMargin = input(false, { transform: booleanAttribute });

  /** If `true`, remove the bottom border for `readonly` inputs */
  // TODO: Skipped for signal migration because:
  //  Your application code writes to the input. This prevents migration.
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input({ transform: booleanAttribute })
  disableReadOnlyBorder = false;

  protected readonly prefixHasChildren = signal(false);
  protected readonly suffixHasChildren = signal(false);

  get inputBorderClasses(): string {
    const shouldFocusBorderAppear = this.defaultContentIsFocused();

    const groupClasses = [
      this.input().hasError
        ? "group-hover/bit-form-field:tw-border-danger-700"
        : "group-hover/bit-form-field:tw-border-primary-600",
      // the next 2 selectors override the above hover selectors when the input (or text area) is non-interactive (i.e. readonly, disabled)
      "group-has-[input:read-only]/bit-form-field:group-hover/bit-form-field:tw-border-secondary-500",
      "group-has-[textarea:read-only]/bit-form-field:group-hover/bit-form-field:tw-border-secondary-500",
      "group-focus-within/bit-form-field:tw-outline-none",
      shouldFocusBorderAppear ? "group-focus-within/bit-form-field:tw-border-2" : "",
      shouldFocusBorderAppear ? "group-focus-within/bit-form-field:tw-border-primary-600" : "",
      shouldFocusBorderAppear
        ? "group-focus-within/bit-form-field:group-hover/bit-form-field:tw-border-primary-600"
        : "",
    ];

    const baseInputBorderClasses = inputBorderClasses(this.input().hasError);

    const borderClasses = baseInputBorderClasses.concat(groupClasses);

    return borderClasses.join(" ");
  }

  @HostBinding("class")
  get classList() {
    return ["tw-block"]
      .concat(this.disableMargin() ? [] : ["tw-mb-4", "bit-compact:tw-mb-3"])
      .concat(this.readOnly ? [] : "tw-pt-2");
  }

  /**
   * If the currently focused element is not part of the default content, then we don't want to show focus on the
   * input field itself.
   *
   * This is necessary because the `tw-group/bit-form-field` wraps the input and any prefix/suffix
   * buttons
   */
  protected readonly defaultContentIsFocused = signal(false);
  @HostListener("focusin", ["$event.target"])
  onFocusIn(target: HTMLElement) {
    this.defaultContentIsFocused.set(target.matches("[data-default-content] *:focus-visible"));
  }
  @HostListener("focusout")
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

    this.prefixHasChildren.set((this.prefixContainer()?.nativeElement.childElementCount ?? 0) > 0);
    this.suffixHasChildren.set((this.suffixContainer()?.nativeElement.childElementCount ?? 0) > 0);
  }
}
