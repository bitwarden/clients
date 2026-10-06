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
      // Focus outside a boundary reveals even while a boundary is hovered
      "[&:has(:focus-visible):not(:has([bitHoverRevealBoundary]_:focus-visible))]:![--bit-hover-reveal:1]",
      "has-[.tw-test-focus-visible]:[--bit-hover-reveal:1]",
      // Touch devices can't hover, so always show; `!` outranks the more specific boundary reset
      "[@media(hover:none)]:![--bit-hover-reveal:1]",
      // Hover inside a boundary doesn't count
      "[&:has([bitHoverRevealBoundary]:hover)]:[--bit-hover-reveal:0]",
    ].join(" "),
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
    class: [
      "tw-opacity-[var(--bit-hover-reveal,1)]",
      "tw-transition-opacity",
      "aria-expanded:tw-opacity-100",
      "[&:has([aria-expanded='true'])]:tw-opacity-100",
    ].join(" "),
  },
})
export class HoverRevealDirective {}
