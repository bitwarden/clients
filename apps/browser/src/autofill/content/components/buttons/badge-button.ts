import { css } from "@emotion/css";
import { html } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { border, themes, typography, spacing } from "../constants/styles";

export function BadgeButton({
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
      class=${badgeButtonStyles({ disabled, theme })}
      @click=${handleButtonClick}
    >
      ${buttonText}
    </button>
  `;
}

const badgeButtonStyles = ({ disabled, theme }: { disabled: boolean; theme: Theme }) => css`
  ${typography.helperMedium}

  user-select: none;
  border-radius: ${border.radius.full};
  padding: ${spacing["1"]} ${spacing["2"]};
  max-height: fit-content;
  overflow: hidden;
  text-align: center;
  text-overflow: ellipsis;
  font-weight: 500;

  ${disabled
    ? `
    border: 0.5px solid ${themes[theme].secondary["300"]};
    background-color: ${themes[theme].secondary["300"]};
    color: ${themes[theme].text.muted};
  `
    : `
    border: 0.5px solid ${themes[theme].primary["700"]};
    background-color: ${themes[theme].primary["100"]};
    cursor: pointer;
    color: ${themes[theme].primary["700"]};

    :hover {
      border-color: ${themes[theme].primary["600"]};
      background-color: ${themes[theme].primary["600"]};
      color: ${themes[theme].text.contrast};
    }
  `}
`;
