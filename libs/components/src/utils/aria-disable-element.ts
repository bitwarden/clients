import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { fromEvent } from "rxjs";

export function ariaDisableElement(element: HTMLElement) {
  element.removeAttribute("disabled");

  element.setAttribute("aria-disabled", "true");

  fromEvent(element, "click")
    .pipe(takeUntilDestroyed())
    .subscribe((event: Event) => {
      event.stopPropagation();
      event.preventDefault();
      return false;
    });
}
