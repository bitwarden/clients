import {
  AfterContentChecked,
  DestroyRef,
  Directive,
  ElementRef,
  inject,
  input,
  NgZone,
  Optional,
} from "@angular/core";
import { take } from "rxjs/operators";

import { Utils } from "@bitwarden/common/platform/misc/utils";

import { FocusableElement } from "../shared/focusable-element";

/**
 * Helper function to query for descendents of a given el that have the AutofocusDirective
 * applied to them
 *
 * @param el element that supports querySelectorAll
 * @returns querySelectorAll results
 */
export function queryForAutofocusDescendents(el: Document | Element) {
  // ensure selectors match the directive selectors
  // Use lowercase — Angular serializes directive attribute names as lowercase in the DOM.
  return el.querySelectorAll("[appautofocus]");
}

/**
 * Transform for the appAutofocus input. Converts attribute presence (`""`) to `true`,
 * passes CSS selector strings through as-is, and preserves `false`.
 */
function autofocusAttribute(value: string | boolean): string | boolean {
  if (value === "" || value === true) {
    return true;
  }
  return value;
}

/**
 * Directive to focus an element.
 *
 * @remarks
 *
 * Will focus the element once, when it becomes visible.
 *
 * When used without a value (`<h2 appAutofocus>`), the host element itself is focused.
 *
 * When used with a CSS selector (`<div appAutofocus="button">`), the first matching
 * descendant is focused instead. Combine with `fallback` to specify a selector queried
 * from the host's parent if the primary yields no match.
 *
 * If the component provides the `FocusableElement` interface, the `focus`
 * method will be called. Otherwise, the native element will be focused.
 */
@Directive({
  selector: "[appAutofocus]",
})
export class AutofocusDirective implements AfterContentChecked {
  readonly appAutofocus = input(undefined, { transform: autofocusAttribute });

  /**
   * Fallback CSS selector queried from the host element if the primary `appAutofocus`
   * selector yields no match.
   */
  readonly appAutofocusFallback = input<string>();

  // Track if we have already focused the element.
  private focused = false;

  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private el: ElementRef,
    private ngZone: NgZone,
    @Optional() private focusableElement: FocusableElement,
  ) {}

  /**
   * Using AfterContentChecked is a hack to ensure we only focus once. This is because
   * the element may not be in the DOM, or not be focusable when the directive is
   * created, and we want to wait until it is.
   *
   * Note: This might break in the future since it relies on Angular change detection
   * to trigger after the element becomes visible.
   */
  ngAfterContentChecked() {
    // We only want to focus the element on initial render and it's not a mobile browser
    if (this.focused || !this.appAutofocus() || Utils.isMobileBrowser) {
      return;
    }

    const el = this.getElement();
    if (el == null) {
      return;
    }

    // Set before scheduling to prevent duplicate subscriptions if ngAfterContentChecked
    // is called multiple times while the zone is unstable.
    this.focused = true;

    if (this.ngZone.isStable) {
      this.focus();
    } else {
      this.ngZone.onStable.pipe(take(1)).subscribe(this.focus.bind(this));
    }
  }

  /**
   * Wait a tick for any focus management to occur on the trigger element before moving
   * focus. We need the timeout even though we are already waiting for ngZone to
   * stabilize — CDK's focus trap and dialog focus-restore bookkeeping may still be
   * in-flight within the same macrotask.
   */
  private focus() {
    const focusTimeout = setTimeout(() => {
      const el = this.getElement();

      if (!el) {
        return;
      }

      const focusScope = this.el.nativeElement.closest("[cdkTrapFocus]") ?? document;
      const activeInScope = focusScope.contains(document.activeElement);
      // Check for our own marker attribute rather than the directive selector attribute,
      // because Angular doesn't write DOM attributes for signal/property bindings.
      const activeWasAutofocused = document.activeElement?.hasAttribute("data-appautofocus");

      if (activeInScope && activeWasAutofocused) {
        return;
      }

      el.setAttribute("data-appautofocus", "");
      this.ngZone.runOutsideAngular(() => el.focus());
    }, 0);

    this.destroyRef.onDestroy(() => clearTimeout(focusTimeout));
  }

  private getElement(): HTMLElement | undefined {
    const value = this.appAutofocus();

    if (typeof value === "string") {
      const container = this.el.nativeElement as HTMLElement;
      const fallback = this.appAutofocusFallback();
      return (
        container.querySelector<HTMLElement>(value) ??
        (fallback ? (container.querySelector<HTMLElement>(fallback) ?? undefined) : undefined)
      );
    }

    if (this.focusableElement) {
      return this.focusableElement.getFocusTarget();
    }

    return this.el.nativeElement;
  }
}
