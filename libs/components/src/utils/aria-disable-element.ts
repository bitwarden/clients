// import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
// import { fromEvent } from "rxjs";

import { Signal, DestroyRef } from "@angular/core";
import { toObservable, takeUntilDestroyed } from "@angular/core/rxjs-interop";

/**
 * a11y helper util used to `aria-disable` elements as opposed to using the HTML `disabled` attr.
 * - Removes HTML `disabled` attr and replaces it with `aria-disabled="true"`
 */
export function ariaDisableElement(
  el: HTMLElement,
  disabled: Signal<boolean | undefined>,
  destroyRef: DestroyRef,
) {
  toObservable(disabled)
    .pipe(takeUntilDestroyed(destroyRef))
    .subscribe((v) => {
      if (v) {
        el.removeAttribute("disabled");
        el.setAttribute("aria-disabled", "true");
      } else {
        el.removeAttribute("aria-disabled");
      }
    });
}
