import { FocusableOption } from "@angular/cdk/a11y";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { NgClass } from "@angular/common";
import { Component, ElementRef, HostBinding, Input } from "@angular/core";

@Component({
  selector: "[bitMenuItem]",
  templateUrl: "menu-item.component.html",
  standalone: true,
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
    "hover:tw-bg-primary-100",
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

  @Input({ transform: coerceBooleanProperty }) disabled?: boolean = false;

  constructor(public elementRef: ElementRef<HTMLButtonElement>) {}

  focus() {
    this.elementRef.nativeElement.focus();
  }
}
