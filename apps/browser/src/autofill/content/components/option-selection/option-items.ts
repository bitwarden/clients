import { css } from "@emotion/css";
import { html } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { themes, typography, spacing } from "../constants/styles";

import { OptionItem, optionItemTagName } from "./option-item";
import { Option } from "./option-selection";

export function OptionItems({
  theme,
  topOffset,
  options,
  handleOptionSelection,
}: {
  theme: Theme;
  topOffset: number;
  options: Option[];
  handleOptionSelection: (selectedOption: Option) => void;
}) {
  return html`
    <div class=${optionsStyles({ theme, topOffset })} key="container">
      ${options.map((option) =>
        OptionItem({ ...option, handleSelection: () => handleOptionSelection(option) }),
      )}
    </div>
  `;
}

const optionsStyles = ({ theme, topOffset }: { theme: Theme; topOffset: number }) => css`
  ${typography.body2}

  -webkit-font-smoothing: antialiased;
  position: absolute;
  /* top offset + line-height of dropdown button + top and bottom padding of button + border-width */
  top: calc(${topOffset}px + 20px + ${spacing["1"]} + ${spacing["1"]} + 1px);
  border: 1px solid ${themes[theme].secondary["500"]};
  border-radius: 0.5rem;
  background-clip: padding-box;
  background-color: ${themes[theme].background.DEFAULT};
  padding: 0.25rem 0;
  max-width: fit-content;
  overflow-y: auto;
  color: ${themes[theme].text.main};

  > [class*="${optionItemTagName}-"] {
    padding: 0.375rem ${spacing["3"]};

    :hover {
      background-color: ${themes[theme].primary["100"]};
    }
  }
`;
