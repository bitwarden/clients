import { FocusableOption } from "@angular/cdk/a11y";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { Component, ElementRef, HostBinding, Input } from "@angular/core";

@Component({
  selector: "[bitMenuItem]",
  templateUrl: "menu-item.component.html",
})
export class MenuItemDirective implements FocusableOption {
  @HostBinding("class") classList = [
    "tw-block",
    "tw-w-full",
    "tw-py-1",
    "tw-px-4",
    "!tw-text-main",
    "!tw-no-underline",
    "tw-cursor-pointer",
    "tw-border-none",
    "tw-bg-background",
    "tw-text-left",
    "hover:tw-bg-secondary-100",
    "focus-visible:tw-bg-secondary-100",
    "focus-visible:tw-z-50",
    "focus-visible:tw-outline-none",
    "focus-visible:tw-ring",
    "focus-visible:tw-ring-offset-2",
    "focus-visible:tw-ring-primary-700",
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

  @Input({ transform: coerceBooleanProperty }) disabled?: boolean = false;

  constructor(private elementRef: ElementRef) {}

  focus() {
    this.elementRef.nativeElement.focus();
  }
}
