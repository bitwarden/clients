import { css } from "@emotion/css";
// import {customElement} from 'lit/decorators.js';
import {ContextConsumer} from '@lit/context';
import { html } from "lit";

// import { define } from "../utils/define";

import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums";

import { NotificationTypes } from "../../abstractions/notification-bar";
import { spacing, themes } from "../../constants/styles";
import { themeContext } from "../../contexts/theme";
import { CipherData } from "../../types";

import { CipherAction } from "./cipher-action";
import { CipherIcon } from "./cipher-icon";
import { CipherInfo } from "./cipher-info";

const cipherIconWidth = "24px";

export function CipherItem({
  cipher,
  handleAction,
  notificationType,
  theme = ThemeTypes.Light,
}: {
  cipher: CipherData;
  handleAction?: (e: Event) => void;
  notificationType: string;
  theme: Theme;
}) {
  const { icon } = cipher;
  const uri = icon.imageEnabled && icon.image;

  let cipherActionButton = null;

  if (notificationType === NotificationTypes.Change || notificationType === NotificationTypes.Add) {
    cipherActionButton = html`<div>
      ${CipherAction({ handleAction, notificationType, theme })}
    </div>`;
  }

  // const test = new ContextConsumer(
  //   document.body,
  //   {context: themeContext}
  // );

  return html`
    <div class=${cipherItemStyles}>
      ${CipherIcon({ color: themes[theme].text.muted, size: cipherIconWidth, theme, uri })}
      ${CipherInfo({ theme, cipher })}
    </div>
    ${cipherActionButton}
  `;
}

const cipherItemStyles = css`
  gap: ${spacing["2"]};
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: start;

  > img,
  > span {
    display: flex;
  }

  > div {
    max-width: calc(100% - ${cipherIconWidth} - ${spacing["2"]});
  }
`;


// customElements.define('cipher-item', CipherItem);
