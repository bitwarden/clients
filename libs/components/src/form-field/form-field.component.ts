import {
  AfterContentChecked,
  Component,
  ContentChild,
  ElementRef,
  HostBinding,
  HostListener,
  Input,
  ViewChild,
  booleanAttribute,
  signal,
} from "@angular/core";

import { BitHintComponent } from "../form-control/hint.component";
import { BitLabel } from "../form-control/label.directive";
import { inputBorderClasses } from "../input/input.directive";

import { BitErrorComponent } from "./error.component";
import { BitFormFieldControl } from "./form-field-control";

@Component({
  selector: "bit-form-field",
  templateUrl: "./form-field.component.html",
})
export class BitFormFieldComponent implements AfterContentChecked {
  @ContentChild(BitFormFieldControl) input: BitFormFieldControl;
  @ContentChild(BitHintComponent) hint: BitHintComponent;
  @ContentChild(BitLabel) label: BitLabel;

  @ViewChild("prefixContainer") prefixContainer: ElementRef<HTMLDivElement>;
  @ViewChild("suffixContainer") suffixContainer: ElementRef<HTMLDivElement>;

  @ViewChild(BitErrorComponent) error: BitErrorComponent;

  @Input({ transform: booleanAttribute })
  disableMargin = false;

  /** If `true`, remove the bottom border for `readonly` inputs */
  @Input({ transform: booleanAttribute })
  disableReadOnlyBorder = false;

  protected prefixHasChildren = signal(false);
  protected suffixHasChildren = signal(false);

  get inputBorderClasses(): string {
    const shouldFocusBorderAppear = this.defaultContentIsFocused();

    const groupClasses = [
      this.input.hasError
        ? "group-hover/bit-form-field:tw-border-danger-700"
        : "group-hover/bit-form-field:tw-border-primary-500",
      "group-focus-within/bit-form-field:tw-outline-none",
      shouldFocusBorderAppear ? "group-focus-within/bit-form-field:tw-border-2" : "",
      shouldFocusBorderAppear ? "group-focus-within/bit-form-field:tw-border-primary-500" : "",
      shouldFocusBorderAppear
        ? "group-focus-within/bit-form-field:group-hover/bit-form-field:tw-border-primary-500"
        : "",
    ];

    const baseInputBorderClasses = inputBorderClasses(this.input.hasError);

    const borderClasses = baseInputBorderClasses.concat(groupClasses);

    return borderClasses.join(" ");
  }

  @HostBinding("class")
  get classList() {
    return ["tw-block", "tw-pt-2"].concat(this.disableMargin ? [] : ["tw-mb-4"]);
  }

  /**
   * If the currently focused element is not part of the default content, then we don't want to show focus on the
   * input field itself.
   *
   * This is necessary because the `tw-group/bit-form-field` wraps the input and any prefix/suffix
   * buttons
   */
  protected defaultContentIsFocused = signal(false);
  @HostListener("focusin", ["$event.target"])
  onFocusIn(target: HTMLElement) {
    this.defaultContentIsFocused.set(target.matches(".default-content *:focus-visible"));
  }
  @HostListener("focusout")
  onFocusOut() {
    this.defaultContentIsFocused.set(false);
  }

  protected get readOnly(): boolean {
    return this.input.readOnly;
  }

  ngAfterContentChecked(): void {
    if (this.error) {
      this.input.ariaDescribedBy = this.error.id;
    } else if (this.hint) {
      this.input.ariaDescribedBy = this.hint.id;
    } else {
      this.input.ariaDescribedBy = undefined;
    }

    this.prefixHasChildren.set(this.prefixContainer?.nativeElement.childElementCount > 0);
    this.suffixHasChildren.set(this.suffixContainer?.nativeElement.childElementCount > 0);
  }
}
