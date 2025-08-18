import { css } from "@emotion/css";
import { html } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { I18n } from "../common-types";
import { spacing, themes } from "../constants/styles";
import { Close as CloseIcon } from "../icons";

export type CloseButtonProps = {
  i18n: I18n;
  handleCloseNotification: (e: Event) => void;
  theme: Theme;
};

export function CloseButton({ handleCloseNotification, i18n, theme }: CloseButtonProps) {
  return html`
    <button
      type="button"
      aria-label=${i18n.close}
      class=${closeButtonStyles(theme)}
      @click=${handleCloseNotification}
    >
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
    vertical-align: middle;
  }
`;
