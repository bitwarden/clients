import { input, HostBinding, Directive, inject, ElementRef, booleanAttribute } from "@angular/core";

import { AriaDisableDirective } from "../a11y";
import { ariaDisableElement } from "../utils";

export const LinkTypes = [
  "primary",
  "secondary",
  "contrast",
  "light",
  "default",
  "subtle",
  "success",
  "warning",
  "danger",
] as const;

export type LinkType = (typeof LinkTypes)[number];

const linkStyles: Record<LinkType, string[]> = {
  primary: ["tw-text-fg-brand", "hover:tw-text-fg-brand-strong"],
  default: ["tw-text-fg-brand", "hover:tw-text-fg-brand-strong"],
  secondary: ["tw-text-fg-heading", "hover:tw-text-fg-heading"],
  light: ["tw-text-fg-white", "hover:tw-text-fg-white", "focus-visible:before:tw-ring-fg-contrast"],
  subtle: ["!tw-text-fg-heading", "hover:tw-text-fg-heading"],
  success: ["tw-text-fg-success", "hover:tw-text-fg-success-strong"],
  warning: ["tw-text-fg-warning", "hover:tw-text-fg-warning-strong"],
  danger: ["tw-text-fg-danger", "hover:tw-text-fg-danger-strong"],
  contrast: [
    "tw-text-fg-contrast",
    "hover:tw-text-fg-contrast",
    "focus-visible:before:tw-ring-fg-contrast",
  ],
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
  "disabled:!tw-text-fg-disabled",
  "disabled:hover:!tw-text-fg-disabled",
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
  "aria-disabled:!tw-text-fg-disabled",
  "aria-disabled:hover:!tw-text-fg-disabled",
  "aria-disabled:hover:tw-no-underline",
];

@Directive()
abstract class LinkDirective {
  readonly linkType = input<LinkType>("default");
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
