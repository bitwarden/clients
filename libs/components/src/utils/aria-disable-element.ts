import { Signal, effect } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { fromEvent } from "rxjs";

/**
 * a11y helper util used to `aria-disable` elements as opposed to using the HTML `disabled` attr.
 * - Removes HTML `disabled` attr and replaces it with `aria-disabled="true"`
 * - Captures click events and prevents them from propagating
 */
export function ariaDisableElement(element: HTMLElement, isDisabled: Signal<boolean | undefined>) {
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
