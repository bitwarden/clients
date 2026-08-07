import { Directive, inject } from "@angular/core";

import { PopupPageComponent } from "./popup-page.component";

/**
 * Applies the above-scroll-area's vertical padding and its scroll-aware bottom separator.
 *
 * This lives on the projected content rather than on `popup-page`'s container because the
 * container can't tell whether the slot rendered anything: components projected into it (banners,
 * callouts) keep a host element in the DOM and decide internally whether to show content, so the
 * container would reserve padding and draw a separator above content that isn't there.
 *
 * Apply it to the element that actually renders — inside the `@if` that gates the content, not on
 * a wrapper that is always present.
 *
 * @example
 * ```html
 * <ng-container slot="above-scroll-area">
 *   @if (showBanner()) {
 *     <div bitAboveScrollArea><bit-callout ...></bit-callout></div>
 *   }
 * </ng-container>
 * ```
 */
@Directive({
  selector: "[bitAboveScrollArea]",
  host: {
    // `bit-compact:` is a CSS variant driven by an ancestor class, so the compact padding stays in
    // the class list — the same way the container declared it before.
    class:
      "tw-block tw-transition-colors tw-duration-200 tw-border-0 tw-border-b tw-border-solid tw-py-3 bit-compact:tw-py-2",
    "[class.tw-border-secondary-300]": "scrolled()",
    "[class.tw-border-transparent]": "!scrolled()",
  },
})
export class AboveScrollAreaDirective {
  protected readonly scrolled = inject(PopupPageComponent).isScrolled;
}
