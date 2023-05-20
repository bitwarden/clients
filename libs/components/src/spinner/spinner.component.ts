import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { Component, HostBinding, Input } from "@angular/core";

@Component({
  selector: "bit-spinner",
  templateUrl: "spinner.component.html",
  standalone: true,
})
export class SpinnerComponent {
  /**
   * The size of the spinner. Defaults to `large`.
   */
  @Input() size: "fill" | "small" | "large" = "large";

  private _noColor = false;

  /**
   * Disable the default color of the spinner, inherits the text color.
   */
  @Input()
  get noColor(): boolean {
    return this._noColor;
  }
  set noColor(value: boolean | "") {
    this._noColor = coerceBooleanProperty(value);
  }

  /**
   * Accessibility title. Defaults to `Loading`.
   */
  @Input() title = "Loading";

  @HostBinding("class") get classList() {
    return ["tw-inline-block", "tw-overflow-hidden"]
      .concat(this.sizeClass)
      .concat([this._noColor ? null : "tw-text-primary-500"]);
  }

  @HostBinding("attr.aria-live") ariaLive = "assertive";
  @HostBinding("attr.aria-atomic") ariaAtomic = "true";

  get sizeClass() {
    switch (this.size) {
      case "small":
        return ["tw-h-4"];
      case "large":
        return ["tw-h-16"];
      default:
        return ["tw-h-full", "tw-w-full"];
    }
  }
}
