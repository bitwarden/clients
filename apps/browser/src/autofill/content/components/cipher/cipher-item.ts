import { css } from "@emotion/css";
import { html } from "lit";

import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums";

import { spacing, themes } from "../../../content/components/constants/styles";
import {
  NotificationType,
  NotificationTypes,
} from "../../../notification/abstractions/notification-bar";
import { I18n } from "../common-types";

import { CipherAction } from "./cipher-action";
import { CipherIcon } from "./cipher-icon";
import { CipherInfo } from "./cipher-info";
import { NotificationCipherData } from "./types";

const cipherIconWidth = "24px";

export type CipherItemProps = {
  cipher: NotificationCipherData;
  handleAction?: (e: Event) => void;
  i18n: I18n;
  notificationType?: NotificationType;
  theme: Theme;
};

export function CipherItem({
  cipher,
  handleAction,
  i18n,
  notificationType,
  theme = ThemeTypes.Light,
}: CipherItemProps) {
  const { icon, name, login } = cipher;
  const uri = (icon.imageEnabled && icon.image) || undefined;

  let cipherActionButton = null;

  if (notificationType === NotificationTypes.Change || notificationType === NotificationTypes.Add) {
    cipherActionButton = html`<div>
      ${CipherAction({
        handleAction,
        i18n,
        itemName: name,
        notificationType,
        theme,
        username: login?.username,
      })}
    </div>`;
  }

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
