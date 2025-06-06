import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { fromEvent } from "rxjs";

export function captureClickEvent(element: HTMLElement) {
  fromEvent(element, "click")
    .pipe(takeUntilDestroyed())
    .subscribe((event: Event) => {
      event.stopPropagation();
      event.preventDefault();
    });
}
