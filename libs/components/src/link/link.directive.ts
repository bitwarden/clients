import { input, HostBinding, Directive, inject, ElementRef, booleanAttribute } from "@angular/core";

import { AriaDisableDirective } from "../a11y";
import { ariaDisableElement } from "../utils";

export type LinkType =
  | "primary"
  | "secondary"
  | "contrast"
  | "light"
  | "default"
  | "subtle"
  | "success"
  | "warning"
  | "danger"
  | "contrast";

const linkStyles: Record<LinkType, string[]> = {
  primary: ["!tw-text-fg-brand", "hover:!tw-text-fg-brand-strong"],
  secondary: ["!tw-text-fg-heading", "hover:!tw-text-fg-heading"],
  light: ["!tw-text-alt2", "hover:!tw-text-alt2", "focus-visible:before:tw-ring-text-alt2"],
  default: ["tw-text-fg-brand", "hover:tw-text-fg-brand-strong"],
  subtle: ["!tw-text-fg-heading", "hover:!tw-text-fg-heading"],
  success: ["!tw-text-success-600", "hover:!tw-text-success-700"],
  warning: ["!tw-text-warning-600", "hover:!tw-text-warning-700"],
  danger: ["!tw-text-danger-600", "hover:!tw-text-danger-700"],
  contrast: ["!tw-text-contrast", "hover:!tw-text-contrast"],
};

const commonStyles = [
  "tw-text-unset",
  "tw-leading-none",
  "tw-px-0",
  "tw-py-0.5",
  "tw-font-semibold",
  "tw-bg-transparent",
  "tw-border-0",
  "tw-border-none",
  "tw-rounded",
  "tw-transition",
  "tw-no-underline",
  "tw-cursor-pointer",
  "hover:tw-underline",
  "hover:tw-decoration-1",
  "disabled:tw-no-underline",
  "disabled:tw-cursor-not-allowed",
  "disabled:!tw-text-secondary-300",
  "disabled:hover:!tw-text-secondary-300",
  "disabled:hover:tw-no-underline",
  "focus-visible:tw-outline-none",
  "focus-visible:tw-underline",
  "focus-visible:tw-decoration-1",
  "focus-visible:before:tw-ring-border-focus",

  // Workaround for html button tag not being able to be set to `display: inline`
  // and at the same time not being able to use `tw-ring-offset` because of box-shadow issue.
  // https://github.com/w3c/csswg-drafts/issues/3226
  // Add `tw-inline`, add `tw-py-0.5` and use regular `tw-ring` if issue is fixed.
  //
  // https://github.com/tailwindlabs/tailwindcss/issues/3595
  // Remove `before:` and use regular `tw-ring` when browser no longer has bug, or better:
  // switch to `outline` with `outline-offset` when Safari supports border radius on outline.
  // Using `box-shadow` to create outlines is a hack and as such `outline` should be preferred.
  "tw-relative",
  "before:tw-content-['']",
  "before:tw-block",
  "before:tw-absolute",
  "before:-tw-inset-x-[0.1em]",
  "before:tw-rounded-md",
  "before:tw-transition",
  "focus-visible:before:tw-ring-2",
  "focus-visible:tw-z-10",
  "aria-disabled:tw-no-underline",
  "aria-disabled:tw-pointer-events-none",
  "aria-disabled:!tw-text-secondary-300",
  "aria-disabled:hover:!tw-text-secondary-300",
  "aria-disabled:hover:tw-no-underline",
];

@Directive()
abstract class LinkDirective {
  readonly linkType = input<LinkType>("primary");
}

/**
  * Text Links and Buttons can use either the `<a>` or `<button>` tags. Choose which based on the action the button takes:

  * - if navigating to a new page, use a `<a>`
  * - if taking an action on the current page, use a `<button>`

  * Text buttons or links are most commonly used in paragraphs of text or in forms to customize actions or show/hide additional form options.
 */
@Directive({
  selector: "a[bitLink]",
})
export class AnchorLinkDirective extends LinkDirective {
  @HostBinding("class") get classList() {
    return ["before:-tw-inset-y-[0.125rem]"]
      .concat(commonStyles)
      .concat(linkStyles[this.linkType()] ?? []);
  }
}

@Directive({
  selector: "button[bitLink]",
  hostDirectives: [AriaDisableDirective],
})
export class ButtonLinkDirective extends LinkDirective {
  private el = inject(ElementRef<HTMLButtonElement>);

  readonly disabled = input(false, { transform: booleanAttribute });

  @HostBinding("class") get classList() {
    return ["before:-tw-inset-y-[0.25rem]"]
      .concat(commonStyles)
      .concat(linkStyles[this.linkType()] ?? []);
  }

  constructor() {
    super();
    ariaDisableElement(this.el.nativeElement, this.disabled);
  }
}
