import { css, html, nothing } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";

import { activateFormButton } from "../button/form-button";
import { AriaTargetHost } from "../core/aria";
import { BitElement } from "../core/bit-element";
import { BitwardenIcon } from "../icon/shared-icon";

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

const linkStyles: Record<LinkType, string> = {
  primary: "tw-text-fg-brand hover:tw-text-fg-brand-strong focus-visible:tw-text-fg-brand-strong",
  default: "tw-text-fg-brand hover:tw-text-fg-brand-strong focus-visible:tw-text-fg-brand-strong",
  secondary: "tw-text-fg-heading hover:tw-text-fg-heading focus-visible:tw-text-fg-heading",
  light:
    "tw-text-fg-white hover:tw-text-fg-white focus-visible:tw-text-fg-white focus-visible:before:tw-ring-fg-contrast",
  subtle: "!tw-text-fg-heading hover:tw-text-fg-heading focus-visible:tw-text-fg-heading",
  success:
    "tw-text-fg-success hover:tw-text-fg-success-strong focus-visible:tw-text-fg-success-strong",
  warning:
    "tw-text-fg-warning hover:tw-text-fg-warning-strong focus-visible:tw-text-fg-warning-strong",
  danger: "tw-text-fg-danger hover:tw-text-fg-danger-strong focus-visible:tw-text-fg-danger-strong",
  contrast:
    "tw-text-fg-contrast hover:tw-text-fg-contrast-strong focus-visible:tw-text-fg-contrast-strong focus-visible:before:tw-ring-fg-contrast",
};

const commonStyles = [
  "tw-inline-flex",
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
  "[&:hover_.text]:tw-underline",
  "[&:hover_.text]:tw-decoration-[.125em]",
  "focus-visible:tw-outline-none",
  "focus-visible:before:tw-ring-border-focus",
  "[&:focus-visible_.text]:tw-underline",
  "[&:focus-visible_.text]:tw-decoration-[.125em]",
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
  "aria-disabled:!tw-text-fg-inactive",
  "aria-disabled:hover:!tw-text-fg-inactive",
  "aria-disabled:hover:tw-no-underline",
  "[&[aria-disabled]:focus-visible_.text]:!tw-no-underline",
].join(" ");

/**
 * Text-styled link or button. Renders an `<a>` when `href` is set, otherwise a `<button>` that
 * participates in its form like a native button.
 *
 * Disabled buttons stay focusable (`aria-disabled`) and swallow clicks. Links can't be disabled.
 *
 * @slot - Label
 * @csspart base - The `<a>` or `<button>`.
 */
@customElement("bit-link")
export class BitLink extends BitElement implements AriaTargetHost {
  static formAssociated = true;

  static shadowRootOptions = { ...BitElement.shadowRootOptions, delegatesFocus: true };

  static styles = [
    BitElement.styles,
    css`
      :host {
        display: inline-flex;
      }
      :host([truncate]) {
        min-width: 0;
        max-width: 100%;
      }
      /* Story hooks for forcing interaction states, matching libs/components. */
      :host(.tw-test-hover) .text,
      :host(.tw-test-focus-visible) .text {
        text-decoration-line: underline;
        text-decoration-thickness: 0.125em;
      }
      :host(.tw-test-focus-visible) [part="base"]::before {
        box-shadow: 0 0 0 2px var(--color-border-focus);
      }
    `,
  ];

  private readonly internals = this.attachInternals();

  @property({ attribute: "link-type", reflect: true }) linkType: LinkType = "primary";

  @property({ attribute: "start-icon" }) startIcon?: BitwardenIcon;

  @property({ attribute: "end-icon" }) endIcon?: BitwardenIcon;

  /**
   * Truncate the text with an ellipsis when it overflows. The link must be constrained by its
   * container for the text to overflow.
   */
  @property({ type: Boolean, reflect: true }) truncate = false;

  @property() href?: string;

  @property() target?: string;

  @property() rel?: string;

  @property() download?: string;

  /** Buttons only. */
  @property({ type: Boolean, reflect: true }) disabled = false;

  /** Buttons only. Native button type; `"submit"` submits the enclosing form. */
  @property() type: "button" | "submit" | "reset" = "button";

  @property() name?: string;

  @property() value?: string;

  /** Accessible name when the label isn't descriptive enough. */
  @property() label?: string;

  @query("a, button") readonly ariaTarget!: HTMLElement | null;

  @state() private hasLabel = true;

  constructor() {
    super();
    // Capture so consumer `click` listeners on the host never see clicks on a disabled button.
    this.addEventListener(
      "click",
      (event) => {
        if (this.isDisabledButton) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      },
      { capture: true },
    );
  }

  get form() {
    return this.internals.form;
  }

  private get isDisabledButton() {
    return this.disabled && !this.href;
  }

  private onButtonClick = () => {
    if (!this.isDisabledButton) {
      activateFormButton(this.form, this.type, { name: this.name, value: this.value });
    }
  };

  private onSlotChange = (event: Event) => {
    this.hasLabel = (event.target as HTMLSlotElement)
      .assignedNodes({ flatten: true })
      .some((node) => node.nodeType === Node.ELEMENT_NODE || node.textContent?.trim());
  };

  render() {
    const classes = `${commonStyles} ${linkStyles[this.linkType] ?? linkStyles.primary} ${
      this.truncate ? "tw-min-w-0 tw-max-w-full" : ""
    }`;
    const iconClasses = this.truncate ? "tw-shrink-0" : "";
    const content = html`<span
      class="tw-flex tw-gap-2 tw-items-center ${this.truncate ? "tw-min-w-0 tw-max-w-full" : ""}"
    >
      ${
        this.startIcon
          ? html`<i class="bwi ${this.startIcon} ${iconClasses}" aria-hidden="true"></i>`
          : nothing
      }
      <span
        class="text ${
          // `tw-truncate` applies `overflow-hidden`, which would clip descenders at the link's
          // `tw-leading-none`, so the vertical padding gives them room without shifting the layout.
          this.truncate ? "tw-min-w-0 tw-truncate tw-py-0.5 -tw-my-0.5" : ""
        }"
        ?hidden=${!this.hasLabel}
        ><slot @slotchange=${this.onSlotChange}></slot
      ></span>
      ${
        this.endIcon
          ? html`<i class="bwi ${this.endIcon} ${iconClasses}" aria-hidden="true"></i>`
          : nothing
      }
    </span>`;

    if (this.href) {
      return html`<a
        part="base"
        class=${classes}
        href=${this.href}
        target=${this.target ?? nothing}
        rel=${this.rel ?? nothing}
        download=${this.download ?? nothing}
        aria-label=${this.label ?? nothing}
        >${content}</a
      >`;
    }
    return html`<button
      part="base"
      type="button"
      class=${classes}
      aria-label=${this.label ?? nothing}
      aria-disabled=${this.disabled ? "true" : nothing}
      @click=${this.onButtonClick}
    >
      ${content}
    </button>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-link": BitLink;
  }
}
