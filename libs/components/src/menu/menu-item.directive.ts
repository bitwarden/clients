import { FocusableOption } from "@angular/cdk/a11y";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { NgClass } from "@angular/common";
import { Component, ElementRef, HostBinding, Input } from "@angular/core";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "[bitMenuItem]",
  templateUrl: "menu-item.component.html",
  imports: [NgClass],
})
export class MenuItemDirective implements FocusableOption {
  @HostBinding("class") classList = [
    "tw-block",
    "tw-w-full",
    "tw-py-1.5",
    "tw-px-3",
    "!tw-text-main",
    "!tw-no-underline",
    "tw-cursor-pointer",
    "tw-border-none",
    "tw-bg-background",
    "tw-text-left",
    "hover:tw-bg-hover-default",
    "focus-visible:tw-z-50",
    "focus-visible:tw-outline-none",
    "focus-visible:tw-ring-2",
    "focus-visible:tw-rounded-lg",
    "focus-visible:tw-ring-inset",
    "focus-visible:tw-ring-primary-600",
    "active:!tw-ring-0",
    "active:!tw-ring-offset-0",
    "disabled:!tw-text-muted",
    "disabled:hover:tw-bg-background",
    "disabled:tw-cursor-not-allowed",
  ];
  @HostBinding("attr.role") role = "menuitem";
  @HostBinding("tabIndex") tabIndex = "-1";
  @HostBinding("attr.disabled") get disabledAttr() {
    return this.disabled || null; // native disabled attr must be null when false
  }

  // TODO: Skipped for signal migration because:
  //  This input overrides a field from a superclass, while the superclass field
  //  is not migrated.
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input({ transform: coerceBooleanProperty }) disabled?: boolean = false;

  constructor(public elementRef: ElementRef<HTMLButtonElement>) {}

  focus() {
    this.elementRef.nativeElement.focus();
  }
}
