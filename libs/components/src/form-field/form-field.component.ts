// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import {
  AfterContentChecked,
  booleanAttribute,
  Component,
  ContentChild,
  ElementRef,
  HostBinding,
  HostListener,
  Input,
  ViewChild,
  signal,
} from "@angular/core";

import { I18nPipe } from "@bitwarden/ui-common";

import { BitHintComponent } from "../form-control/hint.component";
import { BitLabel } from "../form-control/label.component";
import { inputBorderClasses } from "../input/input.directive";

import { BitErrorComponent } from "./error.component";
import { BitFormFieldControl } from "./form-field-control";

@Component({
  selector: "bit-form-field",
  templateUrl: "./form-field.component.html",
  standalone: true,
  imports: [CommonModule, BitErrorComponent, I18nPipe],
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

    const baseInputBorderClasses = inputBorderClasses(this.input.hasError);

    const borderClasses = baseInputBorderClasses.concat(groupClasses);

    return borderClasses.join(" ");
  }

  @HostBinding("class")
  get classList() {
    return ["tw-block"]
      .concat(this.disableMargin ? [] : ["tw-mb-4", "bit-compact:tw-mb-3"])
      .concat(this.readOnly ? [] : "tw-pt-2");
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
