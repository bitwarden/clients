import { Directive } from "@angular/core";

/**
 * Marks a region whose hover or keyboard focus reveals descendant `bitHoverReveal` elements.
 * Scoping uses an inherited custom property, so nested containers stay independent.
 */
@Directive({
  selector: "[bitHoverRevealContainer]",
  host: {
    class: [
      "[--bit-hover-reveal:0]",
      "hover:[--bit-hover-reveal:1]",
      "has-[:focus-visible]:[--bit-hover-reveal:1]",
      "has-[.tw-test-focus-visible]:[--bit-hover-reveal:1]",
      // Touch devices can't hover, so revealed content is always shown
      "[@media(hover:none)]:[--bit-hover-reveal:1]",
      // Hover or focus inside a nested `data-hover-reveal-boundary` region doesn't count
      "[&:has([data-hover-reveal-boundary]:hover)]:[--bit-hover-reveal:0]",
      "[&:has([data-hover-reveal-boundary]_:focus-visible)]:[--bit-hover-reveal:0]",
    ].join(" "),
  },
})
export class HoverRevealContainerDirective {}

/**
 * Hides its host until the nearest `bitHoverRevealContainer` is hovered or focused. Uses opacity so
 * the host stays in the tab order, and stays visible while its menu is open.
 */
@Directive({
  selector: "[bitHoverReveal]",
  host: {
    class: [
      "tw-opacity-[var(--bit-hover-reveal,1)]",
      "tw-transition-opacity",
      "aria-expanded:tw-opacity-100",
      "[&:has([aria-expanded='true'])]:tw-opacity-100",
    ].join(" "),
  },
})
export class HoverRevealDirective {}
