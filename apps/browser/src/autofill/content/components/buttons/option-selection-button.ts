import { css } from "@emotion/css";
import { html, nothing } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { IconProps, Option } from "../common-types";
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
  icon?: Option["icon"];
  isDisabled: boolean;
  isOpen: boolean;
  text?: string;
  theme: Theme;
  handleButtonClick: (e: Event) => void;
}) {
  const selectedOptionIconProps: IconProps = { color: themes[theme].text.muted, theme };

  const buttonIcon = icon?.(selectedOptionIconProps);

  return html`
    <button
      class=${selectionButtonStyles({ isDisabled, theme })}
      title=${text}
      type="button"
      @click=${handleButtonClick}
    >
      ${buttonIcon ?? nothing}
      ${text ? html`<span class=${dropdownButtonTextStyles}>${text}</span>` : nothing}
      ${isOpen
        ? AngleUp({ color: themes[theme].text.muted, theme })
        : AngleDown({ color: themes[theme].text.muted, theme })}
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

  ${isDisabled
    ? `
      border: 1px solid ${themes[theme].secondary["300"]};
      background-color: ${themes[theme].secondary["300"]};
      cursor: not-allowed;
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

  > svg {
    max-width: ${iconSize};
    height: fit-content;
  }
`;

const dropdownButtonTextStyles = css`
  max-width: calc(100% - (${iconSize} * 2));
  overflow-x: hidden;
  text-overflow: ellipsis;
`;
