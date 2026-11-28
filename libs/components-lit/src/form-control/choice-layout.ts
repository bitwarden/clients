import { css, html, nothing, TemplateResult } from "lit";

import { t } from "../core/i18n";
import { renderError } from "../form-field/error";
import { hintClasses } from "../form-field/field-styles";
import "../icon-tile/icon-tile";

/** Ids used inside a choice control's shadow root. */
export const ChoiceIds = {
  control: "control",
  label: "label",
  hint: "hint",
  error: "error",
} as const;

export type ChoiceLayoutOptions = {
  /** The native input (checkbox, radio or switch visual). Give it `id=${ChoiceIds.control}`. */
  control: TemplateResult;
  label: string;
  hint: string;
  hasHint: boolean;
  hideLabel: boolean;
  required: boolean;
  disabled: boolean;
  error: string | null;
  /** Card layout (Angular `bit-form-control-card`) instead of the inline row (`bit-form-control`). */
  card: boolean;
  icon?: string;
  hasStart: boolean;
  /** Tooltip for the card; defaults to the label. */
  title: string;
  disableMargin: boolean;
};

/** Host styles shared by checkbox, radio and switch. */
export const choiceHostStyles = css`
  :host {
    display: block;
  }
  :host([inline]) {
    display: inline-block;
    margin-inline-end: 1rem;
  }
  :host([card]) {
    min-width: 0;
  }
  slot[name="label-end"]::slotted(*),
  slot[name="start"]::slotted(*) {
    pointer-events: auto;
  }
`;

/** `aria-describedby` for the native input. */
export function choiceDescribedBy(options: { error: string | null; hasHint: boolean }) {
  if (options.error) {
    return ChoiceIds.error;
  }
  return options.hasHint ? ChoiceIds.hint : undefined;
}

const labelContent = (label: string) => html`<slot name="label">${label}</slot>`;

/**
 * Lays out a checkbox, radio or switch with its label, hint and error. All ARIA references stay
 * inside the control's shadow root.
 */
export function renderChoiceLayout(options: ChoiceLayoutOptions) {
  return options.card ? renderCard(options) : renderRow(options);
}

function renderRow(o: ChoiceLayoutOptions) {
  const margin = o.disableMargin ? "" : "tw-mb-[var(--bit-choice-margin,theme(spacing.4))]";
  // tw-outline-none supports forced colors mode; ring utility does not
  return html`<div class=${margin}>
    <label
      class="tw-transition tw-items-start tw-gap-2 tw-select-none tw-mb-0 tw-inline-flex tw-rounded has-[:focus-visible]:tw-ring has-[:focus-visible]:tw-ring-border-focus has-[:focus-visible]:tw-outline-none ${
        o.disabled ? "tw-cursor-auto" : "tw-cursor-pointer"
      }"
    >
      ${o.control}
      <!-- minor padding adjustment for visual alignment -->
      <span
        class="tw-inline-flex tw-flex-col tw-pt-px ${
          o.disabled ? "tw-text-fg-inactive" : "tw-text-fg-heading"
        } ${o.hideLabel ? "tw-sr-only" : ""}"
      >
        <span class="tw-text-sm tw-leading-5 tw-font-medium">
          <span id=${ChoiceIds.label}>${labelContent(o.label)}</span>
          <slot name="label-end"></slot>
          ${
            o.required
              ? html`<span class="tw-text-xs tw-font-normal"> (${t("required")})</span>`
              : nothing
          }
        </span>
        <span class="tw-leading-none" ?hidden=${!!o.error || !o.hasHint}>
          <span id=${ChoiceIds.hint} class="${hintClasses} tw-inline-block"
            ><slot name="hint">${o.hint}</slot></span
          >
        </span>
      </span>
    </label>
    ${renderError(ChoiceIds.error, o.error, "tw-mt-1 tw-ms-0.5")}
  </div>`;
}

function renderCard(o: ChoiceLayoutOptions) {
  const box = [
    "tw-flex tw-flex-1 tw-items-center tw-relative tw-isolate tw-p-4 tw-border tw-border-solid tw-border-border-base tw-rounded-xl tw-justify-between tw-gap-4 tw-transition-colors",
    // tw-outline-none supports forced colors mode; ring utility does not
    "has-[input:focus-visible]:tw-ring-2 has-[input:focus-visible]:tw-outline-none has-[input:focus-visible]:tw-ring-border-focus has-[input:focus-visible]:tw-border-transparent",
    o.disabled
      ? ""
      : "has-[label:hover]:tw-border-border-brand-soft has-[input:checked]:tw-bg-bg-brand-softer has-[input:checked]:hover:tw-bg-bg-brand-soft",
  ].join(" ");

  const leading = o.icon
    ? // this positioning style to account for tile staying top aligned when text wraps
      html`<bit-icon-tile
        class="tw-self-start tw-relative tw-top-[2px]"
        icon=${o.icon}
        variant=${o.disabled ? "gray" : "brand"}
      ></bit-icon-tile>`
    : html`<div class="tw-self-start tw-relative" ?hidden=${!o.hasStart}>
        <slot name="start"></slot>
      </div>`;

  return html`<div class="tw-flex tw-h-full tw-flex-col">
    <div class=${box}>
      <label
        for=${ChoiceIds.control}
        aria-hidden="true"
        class="tw-absolute tw-inset-0 tw-rounded-xl ${
          o.disabled ? "tw-cursor-default" : "tw-cursor-pointer"
        }"
        title=${o.title || nothing}
      ></label>
      <div class="tw-flex tw-items-center tw-gap-4 tw-relative tw-pointer-events-none tw-min-w-0">
        ${leading}
        <span
          class="tw-inline-flex tw-flex-col tw-min-w-0 ${
            o.disabled ? "tw-text-fg-inactive" : "tw-text-fg-heading"
          }"
        >
          <span
            class="tw-flex tw-gap-0.5 tw-items-center tw-text-sm tw-leading-5 tw-font-medium ${
              o.hideLabel ? "tw-sr-only" : ""
            }"
          >
            <span id=${ChoiceIds.label} class="tw-truncate">${labelContent(o.label)}</span>
            <slot name="label-end"></slot>
            ${
              o.required
                ? html`<sup
                      aria-hidden="true"
                      class="tw-text-sm tw-text-fg-danger tw-relative tw-top-[-1px]"
                      >*</sup
                    ><span class="tw-sr-only"> (${t("required")})</span>`
                : nothing
            }
          </span>
          <span
            id=${ChoiceIds.hint}
            class="${hintClasses} tw-leading-4 ${o.disabled ? "!tw-text-fg-inactive" : ""}"
            ?hidden=${!o.hasHint}
            ><slot name="hint">${o.hint}</slot></span
          >
        </span>
      </div>
      <div class="tw-relative tw-pointer-events-none tw-flex">${o.control}</div>
    </div>
    ${renderError(ChoiceIds.error, o.error, "tw-mt-2 tw-ms-0.5")}
  </div>`;
}
