// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { FocusableOption } from "@angular/cdk/a11y";
import { Directive, ElementRef, HostBinding, Input, input } from "@angular/core";

/**
 * Directive used for styling tab header items for both nav links (anchor tags)
 * and content tabs (button tags)
 */
@Directive({
  selector: "[bitTabListItem]",
})
export class TabListItemDirective implements FocusableOption {
  readonly active = input<boolean>();
  // TODO: Skipped for signal migration because:
  //  This input overrides a field from a superclass, while the superclass field
  //  is not migrated.
  @Input() disabled: boolean;

  @HostBinding("attr.disabled")
  get disabledAttr() {
    return this.disabled || null; // native disabled attr must be null when false
  }

  constructor(private elementRef: ElementRef) {}

  focus() {
    this.elementRef.nativeElement.focus();
  }

  click() {
    this.elementRef.nativeElement.click();
  }

  @HostBinding("class")
  get classList(): string[] {
    return this.baseClassList
      .concat(this.active() ? this.activeClassList : [])
      .concat(this.disabled ? this.disabledClassList : [])
      .concat(this.textColorClassList);
  }

  /**
   * Classes used for styling tab item text color.
   * Separate text color class list required to override bootstrap classes in Web.
   */
  get textColorClassList(): string[] {
    if (this.disabled) {
      return ["!tw-text-secondary-300", "hover:!tw-text-secondary-300"];
    }
    if (this.active()) {
      return ["!tw-text-primary-600", "hover:!tw-text-primary-700"];
    }
    return ["!tw-text-main", "hover:!tw-text-main"];
  }

  get baseClassList(): string[] {
    return [
      "tw-block",
      "tw-relative",
      "tw-py-2",
      "tw-px-4",
      "tw-font-semibold",
      "tw-transition",
      "tw-rounded-t-lg",
      "tw-border-0",
      "tw-border-x",
      "tw-border-t-4",
      "tw-border-transparent",
      "tw-border-solid",
      "tw-bg-transparent",
      "hover:tw-underline",
      "focus-visible:tw-z-10",
      "focus-visible:tw-outline-none",
      "focus-visible:tw-ring-2",
      "focus-visible:tw-ring-primary-600",
    ];
  }

  get disabledClassList(): string[] {
    return ["!tw-no-underline", "tw-cursor-not-allowed"];
  }

  get activeClassList(): string[] {
    return [
      "tw--mb-px",
      "tw-border-x-secondary-300",
      "tw-border-t-primary-600",
      "tw-border-b",
      "tw-border-b-background",
      "!tw-bg-background",
      "hover:tw-no-underline",
      "hover:tw-border-t-primary-700",
      "focus-visible:tw-border-t-primary-700",
      "focus-visible:!tw-text-primary-700",
    ];
  }
}
