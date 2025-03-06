import createEmotion from "@emotion/css/create-instance";
import { html, LitElement, TemplateResult, nothing } from "lit";
import { property, state } from "lit/decorators.js";

import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums";

import { OptionSelectionButton } from "../buttons/option-selection-button";

import { OptionItems } from "./option-items";

export const optionSelectionTagName = "option-selection";

const { css } = createEmotion({
  key: optionSelectionTagName,
});

export type Option = {
  icon?: TemplateResult;
  activeIcon?: TemplateResult;
  text: string;
  value: any;
};

export class OptionSelection extends LitElement {
  @property({ type: (selectedOption: Option["value"] | null) => selectedOption })
  handleSelectionUpdate = (selectedOptionValue: Option["value"] | null) => selectedOptionValue;

  @property({ type: String })
  buttonText: string = "";

  @property()
  icon?: TemplateResult;

  @property()
  disabled: boolean = false;

  @property()
  theme: Theme = ThemeTypes.Light;

  @property({ type: Array })
  options: Option[] = [];

  @state()
  private showOptions = false;

  @state()
  private menuTopOffset: number = 0;

  @state()
  private selection: Option | null = null;

  private handleButtonClick = (event: Event) => {
    this.menuTopOffset = this.offsetTop;

    if (!this.disabled) {
      this.showOptions = !this.showOptions;
    }
  };

  private handleOptionSelection = (selectedOption: Option) => {
    this.showOptions = false;
    this.selection = selectedOption;

    this.handleSelectionUpdate(selectedOption.value);
  };

  private clearSelection = (event: Event) => {
    event.stopPropagation();

    this.showOptions = false;
    this.selection = null;

    this.handleSelectionUpdate(null);
  };

  protected createRenderRoot() {
    return this;
  }

  render() {
    return html`
      <div class=${optionSelectionStyles}>
        ${OptionSelectionButton({
          icon: this.selection?.activeIcon || this.icon,
          isDisabled: this.disabled,
          isOpen: this.showOptions,
          text: this.selection?.text || this.buttonText,
          theme: this.theme,
          handleButtonClick: this.handleButtonClick,
          handleClearClick: this.clearSelection,
        })}
        ${this.showOptions
          ? OptionItems({
              theme: this.theme,
              topOffset: this.menuTopOffset,
              options: this.options,
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

const optionSelectionStyles = css`
  display: flex;

  > div,
  > button {
    width: 100%;
  }
`;
