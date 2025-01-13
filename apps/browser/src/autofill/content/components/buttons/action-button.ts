import { css } from "@emotion/css";
import { html } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { border, themes, typography, spacing } from "../constants/styles";

export function ActionButton({
  buttonAction,
  buttonText,
  disabled = false,
  theme,
}: {
  buttonAction: (e: Event) => void;
  buttonText: string;
  disabled?: boolean;
  theme: Theme;
}) {
  const handleButtonClick = (event: Event) => {
    if (!disabled) {
      buttonAction(event);
    }
  };

  return html`
    <button
      type="button"
      title=${buttonText}
      class=${actionButtonStyles({ disabled, theme })}
      @click=${handleButtonClick}
    >
      ${buttonText}
    </button>
  `;
}

const actionButtonStyles = ({ disabled, theme }: { disabled: boolean; theme: Theme }) => css`
  ${typography.body2}

  user-select: none;
  border: 1px solid transparent;
  border-radius: ${border.radius.full};
  padding: ${spacing["1"]} ${spacing["3"]};
  width: 100%;
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
  `}
`;
