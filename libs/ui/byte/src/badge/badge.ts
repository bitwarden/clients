import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

export type BadgeVariant =
  | "primary"
  | "subtle"
  | "success"
  | "danger"
  | "warning"
  | "accent-primary";

export type BadgeSize = "small" | "large";

@customElement("bit-badge")
export class BitBadgeElement extends LitElement {
  static styles = css`
    :host {
      display: inline-flex;
      align-items: center;
      gap: 0.125rem;
      border: 1px solid;
      border-radius: 9999px;
      font-weight: 500;
      font-family: var(--font-sans);
      cursor: default;
      box-sizing: border-box;
      max-width: 100%;
      min-width: 0;
    }

    /* Default to primary/large when attributes are unset */
    :host(:not([variant])),
    :host([variant="primary"]) {
      background-color: var(--color-bg-brand-softer);
      border-color: var(--color-border-brand-soft);
      color: var(--color-fg-brand-strong);
    }
    :host([variant="subtle"]) {
      background-color: var(--color-bg-secondary);
      border-color: var(--color-border-base);
      color: var(--color-fg-body);
    }
    :host([variant="success"]) {
      background-color: var(--color-bg-success-soft);
      border-color: var(--color-border-success-soft);
      color: var(--color-fg-success-strong);
    }
    :host([variant="warning"]) {
      background-color: var(--color-bg-warning-soft);
      border-color: var(--color-border-warning-soft);
      color: var(--color-fg-warning-strong);
    }
    :host([variant="danger"]) {
      background-color: var(--color-bg-danger-soft);
      border-color: var(--color-border-danger-soft);
      color: var(--color-fg-danger-strong);
    }
    :host([variant="accent-primary"]) {
      background-color: var(--color-bg-accent-primary-soft);
      border-color: var(--color-border-accent-primary-soft);
      color: var(--color-fg-accent-primary-strong);
    }

    :host(:not([size])),
    :host([size="large"]) {
      font-size: 0.875rem;
      line-height: 1.25rem;
      padding: 0.25rem 0.375rem;
    }
    :host([size="small"]) {
      font-size: 0.75rem;
      line-height: 1rem;
      padding: 0.125rem 0.25rem;
    }

    .label {
      display: inline-block;
      flex: 1 1 auto;
      min-width: 0;
      padding-inline: 0.25rem;
      text-align: start;
    }

    :host([truncate]) .label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: var(--bit-badge-max-width, calc(25ch - 0.5rem));
    }

    ::slotted([slot="start"]) {
      flex-shrink: 0;
      display: inline-flex;
    }
  `;

  /** Color scheme. */
  @property({ reflect: true }) variant: BadgeVariant = "primary";

  /** Size token affecting font and padding. */
  @property({ reflect: true }) size: BadgeSize = "large";

  /**
   * Truncate the label with ellipsis when it exceeds `--bit-badge-max-width`.
   * Set the CSS custom property to override the default max-width.
   */
  @property({ type: Boolean, reflect: true }) truncate = true;

  render() {
    return html`
      <slot name="start"></slot>
      <span class="label"><slot></slot></span>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-badge": BitBadgeElement;
  }
}
