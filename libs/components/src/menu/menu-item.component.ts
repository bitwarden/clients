import { FocusableOption } from "@angular/cdk/a11y";
import { Component, ElementRef, HostBinding, Input } from "@angular/core";

import { BitAsyncClickConfig } from "../async-actions/bit-async-click.directive";
import { ButtonLikeAbstraction } from "../shared/button-like.abstraction";

@Component({
  selector: "[bitMenuItem]",
  templateUrl: "menu-item.component.html",
  providers: [
    BitAsyncClickConfig({ stopPropagation: true }),
    { provide: ButtonLikeAbstraction, useExisting: MenuItemComponent },
  ],
})
export class MenuItemComponent implements FocusableOption, ButtonLikeAbstraction {
  @HostBinding("class") classList = [
    "tw-block",
    "tw-py-1",
    "tw-px-4",
    "!tw-text-main",
    "!tw-no-underline",
    "tw-cursor-pointer",
    "tw-border-none",
    "tw-bg-background",
    "tw-text-left",
    "tw-relative",
    "hover:tw-bg-secondary-100",
    "focus-visible:tw-bg-secondary-100",
    "focus-visible:tw-z-50",
    "focus-visible:tw-outline-none",
    "focus-visible:tw-ring",
    "focus-visible:tw-ring-offset-2",
    "focus-visible:tw-ring-primary-700",
    "active:!tw-ring-0",
    "active:!tw-ring-offset-0",
    "disabled:tw-opacity-60",
  ];
  @HostBinding("attr.role") role = "menuitem";
  @HostBinding("tabIndex") tabIndex = "-1";

  @HostBinding("attr.disabled")
  get disabledAttr() {
    const disabled = this.disabled != null && this.disabled !== false;
    return disabled || this.loading ? true : null;
  }

  @Input() loading = false;
  @Input() disabled = false;

  constructor(private elementRef: ElementRef) {}

  focus() {
    this.elementRef.nativeElement.focus();
  }

  setButtonType() {
    // Not supported
  }
}
