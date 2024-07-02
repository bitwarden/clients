import { coerceBooleanProperty } from "@angular/cdk/coercion";
import {
  AfterContentChecked,
  Component,
  ContentChild,
  HostBinding,
  HostListener,
  Input,
  ViewChild,
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

  @ViewChild(BitErrorComponent) error: BitErrorComponent;

  private _disableMargin = false;
  @Input() set disableMargin(value: boolean | "") {
    this._disableMargin = coerceBooleanProperty(value);
  }
  get disableMargin() {
    return this._disableMargin;
  }

  get labelSpacerDynamicStyle() {
    if (this.label?.width) {
      return { width: `${Math.round(this.label.width)}px` };
    }

    return {};
  }

  get inputBorderClasses(): string {
    const shouldFocusBorderAppear = !this.buttonIsFocused();

    const groupClasses = [
      this.input.hasError
        ? "group-hover/input:tw-border-danger-700"
        : "group-hover/input:tw-border-primary-500",
      "group-focus-within/input:tw-outline-none",
      shouldFocusBorderAppear ? "group-focus-within/input:tw-border-2" : "",
      shouldFocusBorderAppear ? "group-focus-within/input:tw-border-primary-500" : "",
      shouldFocusBorderAppear
        ? "group-focus-within/input:group-hover/input:tw-border-primary-500"
        : "",
    ];

    const baseInputBorderClasses = inputBorderClasses(this.input.hasError);

    const borderClasses = baseInputBorderClasses.concat(groupClasses);

    return borderClasses.join(" ");
  }

  @HostBinding("class")
  get classList() {
    return ["tw-block"].concat(this.disableMargin ? [] : ["tw-mb-6"]);
  }

  /**
   * If the currently focused element is a button, then we don't want to show focus on the
   * input field itself.
   *
   * This is necessary because the `tw-group/input` wraps the input and any prefix/suffix
   * buttons
   */
  protected buttonIsFocused = signal(false);
  @HostListener("focusin", ["$event.target"])
  onFocusIn(target: HTMLElement) {
    this.buttonIsFocused.set(target.matches("button"));
  }
  @HostListener("focusout")
  onFocusOut() {
    this.buttonIsFocused.set(false);
  }

  ngAfterContentChecked(): void {
    if (this.error) {
      this.input.ariaDescribedBy = this.error.id;
    } else if (this.hint) {
      this.input.ariaDescribedBy = this.hint.id;
    } else {
      this.input.ariaDescribedBy = undefined;
    }
  }
}
