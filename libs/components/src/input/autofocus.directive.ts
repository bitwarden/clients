import {
  AfterContentChecked,
  booleanAttribute,
  Directive,
  ElementRef,
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
export class AutofocusDirective implements AfterContentChecked {
  readonly appAutofocus = input(undefined, { transform: booleanAttribute });

  /**
   * Also select the focused element's contents, for a field whose prefilled value is a
   * placeholder the user is expected to type over rather than extend. Opt-in, because
   * selecting a value the user came to append to would be actively hostile.
   *
   * No-op on an element without `select()` (anything but a text input or textarea).
   */
  readonly appAutofocusSelect = input(false, { transform: booleanAttribute });

  // Track if we have already focused the element.
  private focused = false;

  /**
   * Separate from {@link focused}, which deliberately stays false through the Safari focus
   * handoff so focusing can be retried. Selecting must not be retried: by then the user may
   * have typed, and re-selecting would put their work one keystroke from being erased.
   */
  private selected = false;

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

    if (this.ngZone.isStable) {
      this.focus();
    } else {
      this.ngZone.onStable.pipe(take(1)).subscribe(this.focus.bind(this));
    }
  }

  /**
   * Attempt to focus the element. If successful we set focused to true to prevent further focus
   * attempts.
   */
  private focus() {
    const el = this.getElement();

    if (el) {
      if (document.activeElement !== el) {
        el.focus();
        if (this.appAutofocusSelect() && !this.selected) {
          this.selected = true;
          selectContents(el);
        }
      }

      /**
       * Being the active element is not enough to consider the focus settled — the document
       * also has to own focus. Safari's extension popover gives its web view keyboard focus
       * after the page has loaded, and assigns initial focus to the first focusable element,
       * discarding anything focused before that. Staying unlatched lets the attempt repeat on
       * later change detection passes so it survives the handoff.
       */
      this.focused = el === document.activeElement && document.hasFocus();
    }
  }

  private getElement(): HTMLElement | undefined {
    if (this.focusableElement) {
      return this.focusableElement.getFocusTarget();
    }

    return this.el.nativeElement;
  }
}

/** Select an element's value, if it is the kind of element that has one. */
function selectContents(el: HTMLElement): void {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    el.select();
  }
}
