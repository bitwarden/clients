import { Input, HostBinding, Directive } from "@angular/core";

export type LinkType = "primary" | "secondary" | "contrast" | "light";

const linkStyles: Record<LinkType, string[]> = {
  primary: [
    "!tw-text-primary-600",
    "hover:!tw-text-primary-700",
    "focus-visible:before:tw-ring-primary-600",
  ],
  secondary: ["!tw-text-main", "hover:!tw-text-main", "focus-visible:before:tw-ring-primary-600"],
  contrast: [
    "!tw-text-contrast",
    "hover:!tw-text-contrast",
    "focus-visible:before:tw-ring-text-contrast",
  ],
  light: ["!tw-text-alt2", "hover:!tw-text-alt2", "focus-visible:before:tw-ring-text-alt2"],
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
];

@Directive()
abstract class LinkDirective {
  @Input()
  linkType: LinkType = "primary";
}

@Directive({
  selector: "a[bitLink]",
  standalone: true,
})
export class AnchorLinkDirective extends LinkDirective {
  @HostBinding("class") get classList() {
    return ["before:-tw-inset-y-[0.125rem]"]
      .concat(commonStyles)
      .concat(linkStyles[this.linkType] ?? []);
  }
}

@Directive({
  selector: "button[bitLink]",
  standalone: true,
})
export class ButtonLinkDirective extends LinkDirective {
  @HostBinding("class") get classList() {
    return ["before:-tw-inset-y-[0.25rem]"]
      .concat(commonStyles)
      .concat(linkStyles[this.linkType] ?? []);
  }
}
