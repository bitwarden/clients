import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { fromEvent } from "rxjs";

export function captureClickEvent(element: HTMLElement) {
  fromEvent(element, "click")
    .pipe(takeUntilDestroyed())
    .subscribe((event: PointerEvent) => {
      event.stopPropagation();
      event.preventDefault();
    });
}
