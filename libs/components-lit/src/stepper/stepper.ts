import { css, html, LitElement, nothing, PropertyValues } from "lit";
import { customElement, property, queryAll, state } from "lit/decorators.js";

import { BitElement } from "../core/bit-element";
import { uniqueId } from "../core/ids";
import { onResize } from "../resize-observer/resize-observer";
import { typography } from "../typography/typography";

import { BitStep } from "./step";

export type StepperOrientation = "horizontal" | "vertical";

export type StepperSelectionChange = {
  selectedIndex: number;
  previouslySelectedIndex: number;
  selectedStep: BitStep;
  previouslySelectedStep: BitStep | undefined;
};

/** Minimum width per step count before a horizontal stepper collapses to vertical. */
const resizeWidthsMap = new Map([
  [2, 600],
  [3, 768],
  [4, 900],
]);

/**
 * Guides the user through a sequence of `bit-step` children, replacing the CDK-based Angular
 * stepper.
 *
 * Only the selected step and the one after it (once the selected step is completed) can be chosen
 * from the headers. Buttons inside a step with a `bit-stepper-next` or `bit-stepper-previous`
 * attribute move between steps, like CDK's `cdkStepperNext` / `cdkStepperPrevious`.
 *
 * @slot - `bit-step` elements
 * @fires selectionChange - When the selected step changes. `detail` is a `StepperSelectionChange`.
 * @fires selectedIndexChange - When the selected step changes. `detail` is the new index.
 */
@customElement("bit-stepper")
export class BitStepper extends BitElement {
  static shadowRootOptions: ShadowRootInit = {
    ...LitElement.shadowRootOptions,
    slotAssignment: "manual",
  };

  static styles = [
    BitElement.styles,
    css`
      :host {
        display: block;
      }
    `,
  ];

  /**
   * Layout. Defaults to vertical. A horizontal stepper switches to vertical when it is too narrow
   * for its steps.
   */
  @property() orientation?: StepperOrientation;

  /** Requires each earlier step to be completed (or optional) before a later one can be selected. */
  @property({ type: Boolean }) linear = false;

  /** Index of the selected step. Invalid changes (see `linear`, `nonEditable`) are ignored. */
  @property({ type: Number, attribute: "selected-index" })
  get selectedIndex(): number {
    return this._selectedIndex;
  }
  set selectedIndex(index: number) {
    const steps = this.steps;
    if (!steps.length || !this.hasUpdated) {
      // Steps aren't known yet; apply as-is.
      const old = this._selectedIndex;
      this._selectedIndex = index;
      this.requestUpdate("selectedIndex", old);
      return;
    }
    if (index < 0 || index >= steps.length || index === this._selectedIndex) {
      return;
    }
    if (this.selected) {
      this.selected.interacted = true;
    }
    if (this.anyEarlierStepIncomplete(index)) {
      return;
    }
    if (index < this._selectedIndex && steps[index].nonEditable) {
      return;
    }
    this.updateSelectedIndex(index);
  }
  private _selectedIndex = 0;

  /** The selected step. */
  get selected(): BitStep | undefined {
    return this.steps[this._selectedIndex];
  }
  set selected(step: BitStep | undefined) {
    const index = step ? this.steps.indexOf(step) : -1;
    if (index >= 0) {
      this.selectedIndex = index;
    }
  }

  /** The `bit-step` children, in order. */
  get steps(): BitStep[] {
    return Array.from(this.children).filter((el): el is BitStep => el instanceof BitStep);
  }

  @state() private currentOrientation: StepperOrientation = "vertical";

  @queryAll("slot[data-index]") private stepSlots!: NodeListOf<HTMLSlotElement>;

  private readonly contentId = uniqueId("bit-stepper");
  private readonly mutationObserver = new MutationObserver(() => this.requestUpdate());

  constructor() {
    super();
    this.addEventListener("bit-step-change", () => this.requestUpdate());
    this.addEventListener("click", this.onClick);
  }

  connectedCallback() {
    super.connectedCallback();
    this.mutationObserver.observe(this, { childList: true });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.mutationObserver.disconnect();
  }

  /** Selects the next step. */
  next() {
    this.selectedIndex = Math.min(this._selectedIndex + 1, this.steps.length - 1);
  }

  /** Selects the previous step. */
  previous() {
    this.selectedIndex = Math.max(this._selectedIndex - 1, 0);
  }

  /** Resets every step and selects the first. */
  reset() {
    this.updateSelectedIndex(0);
    this.steps.forEach((step) => step.reset());
  }

  /** Selects the step at `index`, subject to the same rules as `selectedIndex`. */
  selectStepByIndex(index: number) {
    this.selectedIndex = index;
  }

  /** Whether the header for the step at `index` can't be chosen. */
  isStepDisabled(index: number): boolean {
    if (this._selectedIndex !== index) {
      return this._selectedIndex === index - 1 ? !this.steps[index - 1]?.completed : true;
    }
    return false;
  }

  protected willUpdate(changed: PropertyValues<this>) {
    if (changed.has("orientation")) {
      this.currentOrientation = this.orientation ?? "vertical";
    }
  }

  protected updated() {
    const steps = this.steps;
    this.stepSlots.forEach((slot) => {
      const step = steps[Number(slot.dataset.index)];
      slot.assign(...(step ? [step] : []));
    });
  }

  private anyEarlierStepIncomplete(index: number): boolean {
    if (!this.linear) {
      return false;
    }
    return this.steps.slice(0, index).some((step) => {
      const control = step.stepControl;
      const incomplete = control
        ? !control.valid || !!control.pending || !step.interacted
        : !step.completed;
      return incomplete && !step.optional && !step.completedOverride;
    });
  }

  private updateSelectedIndex(index: number) {
    const steps = this.steps;
    const previouslySelectedIndex = this._selectedIndex;
    if (index === previouslySelectedIndex) {
      return;
    }
    this._selectedIndex = index;
    this.requestUpdate("selectedIndex", previouslySelectedIndex);
    const detail: StepperSelectionChange = {
      selectedIndex: index,
      previouslySelectedIndex,
      selectedStep: steps[index],
      previouslySelectedStep: steps[previouslySelectedIndex],
    };
    const init = { bubbles: true, composed: true };
    this.dispatchEvent(new CustomEvent("selectionChange", { ...init, detail }));
    this.dispatchEvent(new CustomEvent("selectedIndexChange", { ...init, detail: index }));
  }

  private onClick = (event: MouseEvent) => {
    for (const target of event.composedPath()) {
      if (target === this || target instanceof BitStepper) {
        return;
      }
      if (target instanceof Element && target.hasAttribute("bit-stepper-next")) {
        this.next();
        return;
      }
      if (target instanceof Element && target.hasAttribute("bit-stepper-previous")) {
        this.previous();
        return;
      }
    }
  };

  private handleResize = (entry: ResizeObserverEntry) => {
    // A stepper declared vertical stays vertical regardless of width.
    if (this.orientation === "horizontal") {
      const breakpoint = resizeWidthsMap.get(this.steps.length) || 450;
      this.currentOrientation = entry.contentRect.width < breakpoint ? "vertical" : "horizontal";
    }
  };

  private renderIndicator(step: BitStep, index: number, disabled: boolean) {
    if (step.completed) {
      return html`<span
        class="tw-me-3.5 tw-size-9 tw-shrink-0 tw-rounded-full tw-bg-primary-600 tw-font-medium tw-leading-9 tw-text-contrast tw-text-center"
      >
        <i class="bwi bwi-fw bwi-check" aria-hidden="true"></i>
      </span>`;
    }
    const selected = this._selectedIndex === index;
    const color = selected
      ? "tw-bg-primary-600 tw-text-contrast"
      : disabled
        ? "tw-bg-transparent tw-text-muted"
        : !step.nonEditable
          ? "tw-bg-secondary-300 tw-text-main"
          : "";
    return html`<span
      class="tw-me-3.5 tw-size-9 tw-shrink-0 tw-rounded-full tw-font-medium tw-leading-9 tw-text-center ${color}"
    >
      ${index + 1}
    </span>`;
  }

  private renderLabels(step: BitStep, disabled: boolean) {
    return html`<div class="tw-leading-snug tw-text-left">
      <p class="${typography("body1")} tw-m-0 ${disabled ? "tw-text-muted" : ""}">${step.label}</p>
      ${
        step.subLabel
          ? html`<p class="${typography("body2")} tw-m-0 tw-mt-1 tw-text-muted">
              ${step.subLabel}
            </p>`
          : nothing
      }
    </div>`;
  }

  private headerClass(step: BitStep, disabled: boolean) {
    return !disabled && !step.nonEditable ? "hover:tw-bg-secondary-100" : "";
  }

  private renderHorizontal(steps: BitStep[]) {
    return html`
      <div role="tablist">
        <div class="tw-flex tw-gap-8 tw-justify-between">
          ${steps.map((step, i) => {
            const disabled = this.isStepDisabled(i);
            return html`
              <button
                type="button"
                role="tab"
                ?disabled=${disabled}
                @click=${() => this.selectStepByIndex(i)}
                class="tw-flex tw-p-3 tw-items-center tw-border-none tw-bg-transparent tw-shrink-0 ${this.headerClass(
                  step,
                  disabled,
                )}"
                aria-selected=${this._selectedIndex === i ? "true" : "false"}
                aria-controls=${this.contentId + i}
              >
                ${this.renderIndicator(step, i, disabled)} ${this.renderLabels(step, disabled)}
              </button>
              ${
                i < steps.length - 1
                  ? html`<div
                      class="after:tw-left-0 after:tw-top-[50%] after:-tw-translate-y-[50%] after:tw-h-[2px] after:tw-w-full after:tw-absolute after:tw-bg-secondary-300 after:tw-content-[''] tw-relative tw-w-full"
                    ></div>`
                  : nothing
              }
            `;
          })}
        </div>
      </div>
      ${steps.map(
        (_, i) =>
          html`<div role="tabpanel" id=${this.contentId + i} ?hidden=${this._selectedIndex !== i}>
            <slot data-index=${i}></slot>
          </div>`,
      )}
    `;
  }

  private renderVertical(steps: BitStep[]) {
    return steps.map((step, i) => {
      const disabled = this.isStepDisabled(i);
      const selected = this._selectedIndex === i;
      return html`
        <button
          type="button"
          ?disabled=${disabled}
          @click=${() => this.selectStepByIndex(i)}
          class="tw-flex tw-p-3 tw-w-full tw-items-center tw-border-none tw-bg-transparent ${this.headerClass(
            step,
            disabled,
          )}"
          id=${this.contentId + "accordion" + i}
          aria-expanded=${selected ? "true" : "false"}
          aria-controls=${this.contentId + i}
        >
          ${this.renderIndicator(step, i, disabled)} ${this.renderLabels(step, disabled)}
        </button>
        <div
          id=${this.contentId + i}
          aria-labelledby=${this.contentId + "accordion" + i}
          role="region"
        >
          <div
            class="tw-ms-7 tw-border-solid tw-border-0 tw-border-s tw-border-secondary-300 ${
              i < steps.length - 1 ? "tw-min-h-6" : ""
            }"
          >
            <div class="tw-ps-8 tw-py-2" ?hidden=${!selected}>
              <slot data-index=${i}></slot>
            </div>
          </div>
        </div>
      `;
    });
  }

  render() {
    const steps = this.steps;
    return html`<div ${onResize(this.handleResize)}>
      ${
        this.currentOrientation === "horizontal"
          ? this.renderHorizontal(steps)
          : this.renderVertical(steps)
      }
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-stepper": BitStepper;
  }
}
