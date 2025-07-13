import { Directive, ElementRef, inject, input, output } from "@angular/core";
import { takeUntilDestroyed, toObservable } from "@angular/core/rxjs-interop";
import { filter, fromEvent, map, switchMap } from "rxjs";

@Directive({
  selector: "[bitFocusVisibleWithin]",
})
export class FocusVisibleWithinDirective {
  private elementRef = inject(ElementRef) as ElementRef<HTMLElement>;

  /**
   * Emits when the host element has a child with `:focus-visible`.
   *
   * The target selector can be narrowed with the `selector` input.
   **/
  bitFocusVisibleWithin = output<void>();

  /**
   * The child selector to watch.
   *
   * Defaults to `:focus-visble`, but sometimes it may be useful to be more specific, e.g. `foo-bar:focus-visible`.
   **/
  selector = input<`${string}:focus-visible`>(":focus-visible");

  constructor() {
    toObservable(this.selector)
      .pipe(
        switchMap((selector) =>
          fromEvent(this.elementRef.nativeElement, "focusin").pipe(
            map(() => {
              const activeEl = document.activeElement;
              return (
                !!activeEl &&
                this.elementRef.nativeElement.contains(activeEl) &&
                activeEl.matches(selector)
              );
            }),
          ),
        ),
        filter((hasFocusVisibleWithin) => hasFocusVisibleWithin),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        this.bitFocusVisibleWithin.emit();
      });
  }
}
