import { Directive } from "@angular/core";

/**
 * Marks a region whose hover or keyboard focus reveals descendant `bitHoverReveal` elements.
 * Scoping uses an inherited custom property, so nested containers stay independent.
 */
@Directive({
  selector: "[bitHoverRevealContainer]",
  host: {
    // `!` lets focus outside a boundary, and touch devices (no hover), override the boundary-hover reset.
    class:
      "[--bit-hover-reveal:0] hover:[--bit-hover-reveal:1] [&:has(:focus-visible):not(:has([bitHoverRevealBoundary]_:focus-visible))]:![--bit-hover-reveal:1] has-[.tw-test-focus-visible]:[--bit-hover-reveal:1] [@media(hover:none)]:![--bit-hover-reveal:1] [&:has([bitHoverRevealBoundary]:hover)]:[--bit-hover-reveal:0]",
  },
})
export class HoverRevealContainerDirective {}

/**
 * Excludes its region from the nearest `bitHoverRevealContainer`'s hover and focus reveal.
 * The container matches the attribute, so apply it in templates, not via `hostDirectives`.
 */
@Directive({ selector: "[bitHoverRevealBoundary]" })
export class HoverRevealBoundaryDirective {}

/**
 * Hides its host until the nearest `bitHoverRevealContainer` is hovered or focused. Uses opacity so
 * the host stays in the tab order, and stays visible while its menu is open.
 */
@Directive({
  selector: "[bitHoverReveal]",
  host: {
    class:
      "tw-opacity-[var(--bit-hover-reveal,1)] tw-transition-opacity aria-expanded:tw-opacity-100 [&:has([aria-expanded='true'])]:tw-opacity-100",
  },
})
export class HoverRevealDirective {}
