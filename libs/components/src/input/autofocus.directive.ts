// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { AfterContentChecked, Directive, ElementRef, Input, NgZone, Optional } from "@angular/core";
import { take } from "rxjs/operators";

import { Utils } from "@bitwarden/common/platform/misc/utils";

import { FocusableElement } from "../shared/focusable-element";

/**
 * Directive to focus an element.
 *
 * @remarks
 *
 * Will focus the element once, when it becomes visible.
 *
 * If the component provides the `FocusableElement` interface, the `focus`
 * method will be called. Otherwise, the native element will be focused.
 */
@Directive({
  selector: "[appAutofocus], [bitAutofocus]",
})
export class AutofocusDirective implements AfterContentChecked {
  @Input() set appAutofocus(condition: boolean | string) {
    this.autofocus = condition === "" || condition === true;
  }

  private autofocus: boolean;

  // Track if we have already focused the element.
  private focused = false;

  constructor(
    private el: ElementRef,
    private ngZone: NgZone,
    @Optional() private focusableElement: FocusableElement,
  ) {}

  /**
   * Using AfterContentChecked is a hack to ensure we only focus once. This is because
   * the element may not be in the DOM when the directive is created, and we want to
   * wait until it is in the DOM.
   *
   * Note: This might break in the future since it relies on Angular change detection
   * to trigger after the element becomes visible.
   */
  ngAfterContentChecked() {
    // We only want to focus the element on initial render.
    if (this.focused) {
      return;
    }

    // Wait until the element is visible before attempting to focus it. `checkVisibility` might
    // not be available everywhere so fallback to focusing when it's missing.
    // https://developer.mozilla.org/en-US/docs/Web/API/Element/checkVisibility
    const el = this.getElement();
    if (el && (el.checkVisibility == null || el.checkVisibility({ visibilityProperty: true }))) {
      this.focused = true;

      if (!Utils.isMobileBrowser && this.autofocus) {
        if (this.ngZone.isStable) {
          this.focus();
        } else {
          this.ngZone.onStable.pipe(take(1)).subscribe(this.focus.bind(this));
        }
      }
    }
  }

  private focus() {
    this.getElement().focus();
  }

  private getElement() {
    if (this.focusableElement) {
      return this.focusableElement.getFocusTarget();
    }

    return this.el.nativeElement;
  }
}
