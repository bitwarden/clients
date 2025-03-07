import createEmotion from "@emotion/css/create-instance";
import { html, LitElement, nothing } from "lit";
import { property, state } from "lit/decorators.js";

import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums";

import { OptionSelectionButton } from "../buttons/option-selection-button";
import { Option } from "../common-types";

import { OptionItems } from "./option-items";

export const optionSelectionTagName = "option-selection";

const { css } = createEmotion({
  key: optionSelectionTagName,
});

export class OptionSelection extends LitElement {
  @property()
  disabled: boolean = false;

  @property()
  label?: string;

  @property({ type: Array })
  options: Option[] = [];

  @property()
  theme: Theme = ThemeTypes.Light;

  @property({ type: (selectedOption: Option["value"]) => selectedOption })
  handleSelectionUpdate?: (args: any) => void;

  @state()
  private showOptions = false;

  @state()
  private menuTopOffset: number = 0;

  @state()
  private selection?: Option;

  private handleButtonClick = (event: Event) => {
    this.menuTopOffset = this.offsetTop;

    if (!this.disabled) {
      this.showOptions = !this.showOptions;
    }
  };

  private handleOptionSelection = (selectedOption: Option) => {
    this.showOptions = false;
    this.selection = selectedOption;

    // Any side-effects that should occur from the selection
    this.handleSelectionUpdate?.(selectedOption.value);
  };

  protected createRenderRoot() {
    return this;
  }

  render() {
    if (!this.selection) {
      this.selection = getDefaultOption(this.options);
    }

    return html`
      <div class=${optionSelectionStyles}>
        ${OptionSelectionButton({
          icon: this.selection?.icon,
          isDisabled: this.disabled,
          isOpen: this.showOptions,
          text: this.selection?.text,
          theme: this.theme,
          handleButtonClick: this.handleButtonClick,
        })}
        ${this.showOptions
          ? OptionItems({
              label: this.label,
              options: this.options,
              theme: this.theme,
              topOffset: this.menuTopOffset,
              handleOptionSelection: this.handleOptionSelection,
            })
          : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    [optionSelectionTagName]: OptionSelection;
  }
}

export default customElements.define(optionSelectionTagName, OptionSelection);

function getDefaultOption(options: Option[] = []) {
  return options.find((option: Option) => option.default) || options[0];
}

const optionSelectionStyles = css`
  display: flex;

  > div,
  > button {
    width: 100%;
  }
`;
