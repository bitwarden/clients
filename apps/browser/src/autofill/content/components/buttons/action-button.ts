import { css } from "@emotion/css";
import { html, TemplateResult } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { border, themes, typography, spacing } from "../constants/styles";
import { Spinner } from "../icons";

export type ActionButtonProps = {
  buttonText: string | TemplateResult;
  dataTestId?: string;
  disabled?: boolean;
  isLoading?: boolean;
  theme: Theme;
  handleClick: (e: Event) => void;
  fullWidth?: boolean;
};

export function ActionButton({
  buttonText,
  dataTestId,
  disabled = false,
  isLoading = false,
  theme,
  handleClick,
  fullWidth = true,
}: ActionButtonProps) {
  const handleButtonClick = (event: Event) => {
    if (!disabled && !isLoading) {
      handleClick(event);
    }
  };

  return html`
    <button
      class=${actionButtonStyles({ disabled, fullWidth, isLoading, theme })}
      data-testid="${dataTestId}"
      title=${buttonText}
      type="button"
      @click=${handleButtonClick}
    >
      ${isLoading ? Spinner({ theme, color: themes[theme].text.muted }) : buttonText}
    </button>
  `;
}

const actionButtonStyles = ({
  disabled,
  fullWidth,
  isLoading,
  theme,
}: {
  disabled: boolean;
  fullWidth: boolean;
  isLoading: boolean;
  theme: Theme;
}) => css`
  ${typography.body2}

  user-select: none;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  border-radius: ${border.radius.full};
  padding: ${spacing["1"]} ${spacing["3"]};
  width: ${fullWidth ? "100%" : "auto"};
  overflow: hidden;
  text-align: center;
  text-overflow: ellipsis;
  font-weight: 700;

  ${disabled || isLoading
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
    padding: 2px 0; /* Match line-height of button body2 typography */
    width: auto;
    height: 16px;
  }
`;
