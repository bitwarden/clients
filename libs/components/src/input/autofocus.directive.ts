import {
  AfterContentChecked,
  booleanAttribute,
  Directive,
  ElementRef,
  input,
  NgZone,
  OnDestroy,
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
  return el.querySelectorAll("[appAutofocus], [bitAutofocus]");
}

/**
 * Directive to focus an element.
 *
 * @remarks
 *
 * Will focus the element once, when it becomes visible.
 *
 * If the component provides the `FocusableElement` interface, the `focus`
 * method will be called. Otherwise, the native element will be focused. *
 */
@Directive({
  selector: "[appAutofocus], [bitAutofocus]",
})
export class AutofocusDirective implements AfterContentChecked, OnDestroy {
  readonly appAutofocus = input(undefined, { transform: booleanAttribute });

  // Track if we have already focused the element.
  private focused = false;

  // Defers focusing until the window regains focus.
  private deferredFocusListener?: () => void;

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

    this.focusWhenWindowFocused();
  }

  ngOnDestroy() {
    this.removeDeferredFocusListener();
  }

  /**
   * Focus the element, but only while the window has focus.
   *
   * Focusing an input in a backgrounded window can enable macOS Secure Keyboard Input, which
   * blocks global hotkeys in other applications until Bitwarden is closed. When the window isn't
   * focused, defer until it regains focus.
   *
   * @see https://github.com/bitwarden/clients/issues/13241
   */
  private focusWhenWindowFocused() {
    if (!document.hasFocus()) {
      if (this.deferredFocusListener == null) {
        this.deferredFocusListener = () => {
          this.removeDeferredFocusListener();
          this.focusOnceStable();
        };
        window.addEventListener("focus", this.deferredFocusListener);
      }
      return;
    }

    this.focusOnceStable();
  }

  private focusOnceStable() {
    if (this.focused) {
      return;
    }

    if (this.ngZone.isStable) {
      this.focus();
    } else {
      this.ngZone.onStable.pipe(take(1)).subscribe(this.focus.bind(this));
    }
  }

  private removeDeferredFocusListener() {
    if (this.deferredFocusListener != null) {
      window.removeEventListener("focus", this.deferredFocusListener);
      this.deferredFocusListener = undefined;
    }
  }

  /**
   * Attempt to focus the element. If successful we set focused to true to prevent further focus
   * attempts.
   */
  private focus() {
    const el = this.getElement();

    if (el) {
      el.focus();
      this.focused = el === document.activeElement;
    }
  }

  private getElement(): HTMLElement | undefined {
    if (this.focusableElement) {
      return this.focusableElement.getFocusTarget();
    }

    return this.el.nativeElement;
  }
}
