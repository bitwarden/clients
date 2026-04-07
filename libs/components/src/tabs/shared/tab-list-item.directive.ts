import { FocusableOption } from "@angular/cdk/a11y";
import { Directive, ElementRef, Input, input } from "@angular/core";

/**
 * Directive used for styling tab header items for both nav links (anchor tags)
 * and content tabs (button tags)
 */
@Directive({
  selector: "[bitTabListItem]",
  host: {
    "[attr.disabled]": "disabled || null",
    "[attr.aria-selected]": "active() === true",
    "[class]": "classList",
  },
})
export class TabListItemDirective implements FocusableOption {
  readonly active = input<boolean>();
  // TODO: Skipped for signal migration because:
  //  This input overrides a field from a superclass, while the superclass field
  //  is not migrated.
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() disabled = false;

  constructor(readonly elementRef: ElementRef) {}

  focus() {
    this.elementRef.nativeElement.focus();
  }

  click() {
    this.elementRef.nativeElement.click();
  }

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
      return ["!tw-text-fg-disabled", "hover:!tw-text-fg-disabled"];
    }
    if (this.active()) {
      return ["!tw-text-fg-brand"];
    }
    return ["!tw-text-fg-body", "hover:!tw-text-fg-brand"];
  }

  readonly baseClassList: string[] = [
    "tw-block",
    "tw-relative",
    "tw-shrink-0",
    "tw-whitespace-nowrap",
    "tw--mb-px",
    "tw-pb-3",
    "tw-text-sm",
    "tw-font-medium",
    "tw-transition",
    "tw-border-0",
    "tw-border-b-2",
    "tw-border-transparent",
    "tw-border-solid",
    "tw-bg-transparent",
    "tw-outline-none",
    "tw-group/tab-list-item",
  ];

  readonly disabledClassList: string[] = ["tw-cursor-not-allowed"];

  readonly activeClassList: string[] = ["tw-font-semibold", "tw-border-bg-brand"];
}
