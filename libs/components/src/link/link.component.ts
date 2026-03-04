import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  booleanAttribute,
  inject,
  ElementRef,
} from "@angular/core";

import { BitwardenIcon } from "../shared/icon";
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
  "[&:hover_span]:tw-underline",
  "[&.tw-test-hover_span]:tw-underline",
  "[&:hover_span]:tw-decoration-[.125em]",
  "[&.tw-test-hover_span]:tw-decoration-[.125em]",
  "focus-visible:tw-outline-none",
  "focus-visible:before:tw-ring-border-focus",
  "[&:focus-visible_span]:tw-underline",
  "[&:focus-visible_span]:tw-decoration-[.125em]",
  "[&.tw-test-focus-visible_span]:tw-underline",
  "[&.tw-test-focus-visible_span]:tw-decoration-[.125em]",

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
  "before:-tw-inset-y-[0]",
  "before:tw-rounded-md",
  "before:tw-transition",
  "before:tw-h-full",
  "before:tw-w-[calc(100%_+_.25rem)]",
  "before:tw-pointer-events-none",
  "focus-visible:before:tw-ring-2",
  "focus-visible:tw-z-10",
  "aria-disabled:tw-no-underline",
  "aria-disabled:tw-pointer-events-none",
  "aria-disabled:!tw-text-fg-disabled",
  "aria-disabled:hover:!tw-text-fg-disabled",
  "aria-disabled:hover:tw-no-underline",
  "[&[aria-disabled]:focus-visible_span]:!tw-no-underline",
];

@Component({
  selector: "a[bitLink], button[bitLink]",
  templateUrl: "./link.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "[class]": "classList()",
    // This is for us to be able to correctly aria-disable the button and capture clicks.
    // It's normally added via the AriaDisableDirective as a host directive.
    // But, we're not able to conditionally apply the host directive based on if this is a button or not
    "[attr.bit-aria-disable]": "isButton ? true : null",
  },
})
export class LinkComponent {
  readonly el = inject(ElementRef<HTMLElement>);
  /**
   * The variant of link you want to render
   * @default "primary"
   */
  readonly linkType = input<LinkType>("primary");
  /**
   * The leading icon to display within the link
   * @default undefined
   */
  readonly startIcon = input<BitwardenIcon | undefined>(undefined);
  /**
   * The trailing icon to display within the link
   * @default undefined
   */
  readonly endIcon = input<BitwardenIcon | undefined>(undefined);
  /**
   * Whether the button is disabled
   * @default false
   * @note Only applicable if the link is rendered as a button
   */
  readonly disabled = input(false, { transform: booleanAttribute });

  protected readonly isButton = this.el.nativeElement.tagName === "BUTTON";

  readonly classList = computed(() => {
    return [!this.isButton && "tw-inline-flex"]
      .concat(commonStyles)
      .concat(linkStyles[this.linkType()] ?? []);
  });

  focus() {
    this.el.nativeElement.focus();
  }

  constructor() {
    if (this.isButton) {
      ariaDisableElement(this.el.nativeElement, this.disabled);
    }
  }
}
