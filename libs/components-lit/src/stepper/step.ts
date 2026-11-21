import { css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

import { BitElement } from "../core/bit-element";

/**
 * Validity source for a step, e.g. an Angular `FormGroup` or any object with the same shape.
 * Replaces CDK's `stepControl`.
 */
export type StepControl = {
  readonly valid: boolean;
  readonly pending?: boolean;
  reset?(): void;
};

/**
 * A step inside `bit-stepper`. Its content is shown while it is the selected step.
 *
 * Must be a direct child of `bit-stepper`.
 *
 * @slot - Step content
 */
@customElement("bit-step")
export class BitStep extends BitElement {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: block;
      }
    `,
  ];

  /** Main label shown in the step header. */
  @property() label = "";

  /** An optional supplemental label to display below the main label. */
  @property({ attribute: "sub-label" }) subLabel?: string;

  /** Linear steppers don't require this step to be completed before moving past it. */
  @property({ type: Boolean }) optional = false;

  /**
   * Prevents returning to this step once the stepper has moved past it. Inverse of CDK's
   * `editable`, so the boolean can default to `false`.
   */
  @property({ type: Boolean, attribute: "non-editable" }) nonEditable = false;

  /**
   * When set, decides validity: the step is completed once it is valid and the user has moved
   * past it. Changes to its validity aren't observed; set `completed` or call `requestUpdate()` on
   * the stepper to refresh the headers.
   */
  @property({ attribute: false }) stepControl?: StepControl;

  /** Whether the user has visited and then left this step. Set by `bit-stepper`. */
  @property({ type: Boolean, attribute: false }) interacted = false;

  /**
   * Whether the step is completed. Setting it overrides the default, which is: valid and
   * `interacted` with a `stepControl`, otherwise just `interacted`.
   */
  @property({ type: Boolean })
  get completed(): boolean {
    return this.completedOverride ?? this.defaultCompleted;
  }
  set completed(value: boolean | undefined) {
    const old = this.completed;
    this.completedOverride = value ?? undefined;
    this.requestUpdate("completed", old);
  }

  /** @internal Explicit `completed` value, if any. */
  completedOverride?: boolean;

  private get defaultCompleted(): boolean {
    return this.stepControl ? this.stepControl.valid && this.interacted : this.interacted;
  }

  /** Clears `interacted`, resets the `stepControl`, and unsets a `completed` override. */
  reset() {
    this.interacted = false;
    if (this.completedOverride != null) {
      this.completed = false;
    }
    this.stepControl?.reset?.();
  }

  protected updated() {
    this.dispatchEvent(new Event("bit-step-change", { bubbles: true }));
  }

  render() {
    return html`<slot></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-step": BitStep;
  }
}
