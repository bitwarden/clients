import { css } from "@emotion/css";
import { html } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { spacing, themes } from "../constants/styles";
import { Close as CloseIcon } from "../icons";

export function CloseButton({
  handleCloseNotification,
  theme,
}: {
  handleCloseNotification: (e: Event) => void;
  theme: Theme;
}) {
  return html`
    <button type="button" class=${closeButtonStyles(theme)} @click=${handleCloseNotification}>
      ${CloseIcon({ theme })}
    </button>
  `;
}

const closeButtonStyles = (theme: Theme) => css`
  border: 1px solid transparent;
  border-radius: ${spacing["1"]};
  background-color: transparent;
  cursor: pointer;
  width: 36px;
  height: 36px;

  :hover {
    border: 1px solid ${themes[theme].primary["600"]};
  }

  > svg {
    width: 20px;
    height: 20px;
  }
`;
