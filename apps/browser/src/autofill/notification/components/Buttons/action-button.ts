import { css } from '@emotion/css'
import { html } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { border, themes, typography, spacing } from "../../constants/styles";

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
    <button type="button" title=${buttonText} class=${buttonStyles({disabled, theme})} @click=${handleButtonClick}>
      ${buttonText}
    </button>
  `;
}

const buttonStyles = ({disabled, theme}: {disabled: boolean, theme: Theme}) => css`
  ${typography.body1}

  user-select: none;
  border-radius: ${border.radius.full};
  padding: ${spacing['1.5']} ${spacing['4']};
  max-width: 50%;
  overflow: hidden;
  text-align: center;
  text-overflow: ellipsis;
  font-weight: 700;
  border: 1px solid transparent;

  ${disabled ? `
    background-color: ${themes[theme].secondary['300']};
    color: ${themes[theme].text.muted};
  ` : `
    background-color: ${themes[theme].primary['600']};
    cursor: pointer;
    color: ${themes[theme].text.contrast};

    :hover {
      border-color: ${themes[theme].primary['700']};
      background-color: ${themes[theme].primary['700']};
      text-decoration: underline;
      color: ${themes[theme].text.contrast};
  `}
  }
`;
