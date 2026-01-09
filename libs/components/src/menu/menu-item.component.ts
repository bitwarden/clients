import { NgClass } from "@angular/common";
import { Component, computed, ElementRef, inject, model } from "@angular/core";

import { AriaDisableDirective } from "../a11y";
import { ButtonLikeAbstraction } from "../shared/button-like.abstraction";
import { SpinnerComponent } from "../spinner";
import { ariaDisableElement } from "../utils";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "[bitMenuItem]",
  templateUrl: "menu-item.component.html",
  imports: [NgClass, SpinnerComponent],
  providers: [{ provide: ButtonLikeAbstraction, useExisting: MenuItemComponent }],
  hostDirectives: [AriaDisableDirective],
  host: {
    class:
      "tw-block tw-w-full tw-py-1.5 tw-px-3 !tw-text-main !tw-no-underline tw-cursor-pointer tw-border-none tw-bg-background tw-text-left hover:tw-bg-hover-default focus-visible:tw-z-50 focus-visible:tw-outline-none focus-visible:tw-ring-2 focus-visible:tw-rounded-lg focus-visible:tw-ring-inset focus-visible:tw-ring-primary-600 active:!tw-ring-0 active:!tw-ring-offset-0 aria-disabled:!tw-text-muted aria-disabled:hover:tw-bg-background aria-disabled:tw-cursor-not-allowed",
    role: "menuitem",
    tabIndex: "-1",
    "[attr.aria-label]":
      "loading() ? `In progress: ${this.elementRef.nativeElement.textContent}` : null",
  },
})
export class MenuItemComponent implements ButtonLikeAbstraction {
  readonly disabled = model<boolean>(false);
  readonly loading = model<boolean>(false);

  readonly elementRef = inject(ElementRef<HTMLButtonElement>);

  protected readonly disabledAttr = computed(() => {
    const disabled = this.disabled() != null && this.disabled() !== false;
    return disabled || this.loading();
  });

  constructor() {
    ariaDisableElement(this.elementRef.nativeElement, this.disabledAttr);
  }

  focus() {
    this.elementRef.nativeElement.focus();
  }
}
