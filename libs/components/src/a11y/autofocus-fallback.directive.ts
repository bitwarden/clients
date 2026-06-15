import {
  DestroyRef,
  Directive,
  effect,
  ElementRef,
  inject,
  model,
  NgZone,
  signal,
} from "@angular/core";
import { firstValueFrom } from "rxjs";

import { Utils } from "@bitwarden/common/platform/misc/utils";

import { queryForAutofocusDescendents } from "../input";

/**
 * Use this directive on a container element that needs to configure a fallback autofocus element,
 * if no other children have the autofocus directive applied to them.
 */
@Directive({
  selector: "[bitAutofocusFallback]",
})
export class AutofocusFallbackDirective {
  private readonly destroyRef = inject(DestroyRef);
  private readonly ngZone = inject(NgZone);
  private readonly el = inject(ElementRef);

  /**
   * Pass the element ref of the element that should be autofocused as the fallback if no other
   * child elements of the container possess the autofocus directive.
   */
  readonly bitAutofocusFallback = model<ElementRef<HTMLElement>>();

  // Track if we have already focused the element.
  private readonly focused = signal(false);

  constructor() {
    effect(async () => {
      const fallback = this.bitAutofocusFallback();

      if (this.focused() || Utils.isMobileBrowser || !fallback) {
        return;
      }

      const fallbackEl = fallback.nativeElement;

      /**
       * Wait for the zone to stabilize before performing any focus behaviors. This ensures that all
       * child elements are rendered and stable.
       */
      if (this.ngZone.isStable) {
        this.handleFocus(fallbackEl);
      } else {
        await firstValueFrom(this.ngZone.onStable);
        this.handleFocus(fallbackEl);
      }
    });
  }

  private handleFocus(fallbackEl: HTMLElement) {
    const hasAutofocusDescendants = this.checkForAutofocusDescendants();

    if (!hasAutofocusDescendants) {
      this.focusAfterTimeout(fallbackEl);
    }
  }

  /**
   * Focus the element after a timeout to allow any other focus management behavior to occur first.
   * If successful, we set focused to true to prevent further focus attempts.
   */
  private focusAfterTimeout(fallbackEl: HTMLElement) {
    const focusTimeout = setTimeout(() => {
      fallbackEl.focus();
      this.focused.set(fallbackEl === document.activeElement);
    }, 0);

    this.destroyRef.onDestroy(() => clearTimeout(focusTimeout));
  }

  private checkForAutofocusDescendants() {
    const containerEl = this.el.nativeElement;

    if (containerEl) {
      const autofocusDescendants = queryForAutofocusDescendents(containerEl);
      const hasAutofocusDescendants = autofocusDescendants.length > 0;

      return hasAutofocusDescendants;
    }

    return false;
  }
}
