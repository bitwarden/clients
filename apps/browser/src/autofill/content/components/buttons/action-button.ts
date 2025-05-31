import { css } from "@emotion/css";
import { html, TemplateResult } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { border, themes, typography, spacing } from "../constants/styles";

export type ActionButtonProps = {
  buttonText: string | TemplateResult;
  disabled?: boolean;
  theme: Theme;
  handleClick: (e: Event) => void;
  fullWidth?: boolean;
};

export function ActionButton({
  buttonText,
  disabled = false,
  theme,
  handleClick,
  fullWidth = true,
}: ActionButtonProps) {
  const handleButtonClick = (event: Event) => {
    if (!disabled) {
      handleClick(event);
    }
  };

  return html`
    <button
      class=${actionButtonStyles({ disabled, theme, fullWidth })}
      title=${buttonText}
      type="button"
      @click=${handleButtonClick}
    >
      ${buttonText}
    </button>
  `;
}

const actionButtonStyles = ({
  disabled,
  theme,
  fullWidth,
}: {
  disabled: boolean;
  theme: Theme;
  fullWidth: boolean;
}) => css`
  ${typography.body2}

  user-select: none;
  border: 1px solid transparent;
  border-radius: ${border.radius.full};
  padding: ${spacing["1"]} ${spacing["3"]};
  width: ${fullWidth ? "100%" : "auto"};
  overflow: hidden;
  text-align: center;
  text-overflow: ellipsis;
  font-weight: 700;

  ${disabled
    ? `
    background-color: ${themes[theme].secondary["300"]};
    color: ${themes[theme].text.muted};
  `
    : `
    background-color: ${themes[theme].primary["600"]};
    cursor: pointer;
    color: ${themes[theme].text.contrast};

    :hover {
      border-color: ${themes[theme].primary["700"]};
      background-color: ${themes[theme].primary["700"]};
      color: ${themes[theme].text.contrast};
    }
    :focus {
      outline: 2px solid ${themes[theme].primary["600"]};
      outline-offset: 1px;
    }
  `}

  svg {
    width: fit-content;
    height: 16px;
  }
`;
