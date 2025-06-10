import { Signal, effect } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { fromEvent } from "rxjs";

export function ariaDisableElement(element: HTMLElement, isDisabled: Signal<boolean>) {
  effect(() => {
    if (element.hasAttribute("disabled") || isDisabled()) {
      // Remove native disabled and set aria-disabled. Capture click event
      element.removeAttribute("disabled");

      element.setAttribute("aria-disabled", "true");
    }
  });

  fromEvent(element, "click")
    .pipe(takeUntilDestroyed())
    .subscribe((event: Event) => {
      if (isDisabled()) {
        event.stopPropagation();
        event.preventDefault();
        return false;
      }
    });
}
