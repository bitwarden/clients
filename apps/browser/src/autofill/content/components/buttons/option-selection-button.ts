import { css } from "@emotion/css";
import { html, nothing, TemplateResult } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { border, spacing, themes, typography } from "../constants/styles";
import { AngleUp, AngleDown } from "../icons";

export function OptionSelectionButton({
  icon,
  isDisabled,
  isOpen,
  text,
  theme,
  handleButtonClick,
}: {
  isOpen: boolean;
  text: string;
  icon?: TemplateResult;
  isDisabled: boolean;
  theme: Theme;
  handleButtonClick: (e: Event) => void;
}) {
  return html`
    <button
      type="button"
      title=${text}
      class=${selectionButtonStyles({ isDisabled, theme })}
      @click=${handleButtonClick}
    >
      ${icon ?? nothing}
      <span class=${dropdownButtonTextStyles}>${text}</span>
      ${isOpen
        ? AngleUp({ color: themes[theme].text.muted, theme: theme })
        : AngleDown({ color: themes[theme].text.muted, theme: theme })}
    </button>
  `;
}

const iconSize = "15px";

const selectionButtonStyles = ({ isDisabled, theme }: { isDisabled: boolean; theme: Theme }) => css`
  ${typography.body2}

  gap: ${spacing["1.5"]};
  user-select: none;
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: space-between;
  border-radius: ${border.radius.full};
  padding: ${spacing["1"]} ${spacing["2"]};
  max-height: fit-content;
  overflow: hidden;
  text-align: center;
  text-overflow: ellipsis;
  font-weight: 400;

  > svg {
    max-width: ${iconSize};
    height: fit-content;
  }

  ${isDisabled
    ? `
      border: 1px solid ${themes[theme].secondary["300"]};
      background-color: ${themes[theme].secondary["300"]};
      color: ${themes[theme].text.muted};
    `
    : `
      border: 1px solid ${themes[theme].text.muted};
      background-color: transparent;
      cursor: pointer;
      color: ${themes[theme].text.muted};

      :hover {
        border-color: ${themes[theme].secondary["700"]};
        background-color: ${themes[theme].secondary["100"]};
      }
    `}
`;

const dropdownButtonTextStyles = css`
  max-width: calc(100% - ${iconSize} - ${iconSize});
  overflow-x: hidden;
  text-overflow: ellipsis;
`;
