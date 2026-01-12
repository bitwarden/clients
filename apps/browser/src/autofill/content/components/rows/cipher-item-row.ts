import { css } from "@emotion/css";
import { html } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { NotificationType } from "../../../notification/abstractions/notification-bar";
import { CipherItem } from "../cipher/cipher-item";
import { NotificationCipherData } from "../cipher/types";
import { I18n } from "../common-types";
import { spacing, themes, typography } from "../constants/styles";

export type CipherItemRowProps = {
  cipher: NotificationCipherData;
  i18n: I18n;
  notificationType?: NotificationType;
  theme: Theme;
  handleAction: (e: Event) => void;
};

export function CipherItemRow({
  cipher,
  i18n,
  notificationType,
  theme,
  handleAction,
}: CipherItemRowProps) {
  return html`
    <div class=${cipherItemRowStyles({ theme })}>
      ${CipherItem({
        cipher,
        i18n,
        notificationType,
        theme,
        handleAction,
      })}
    </div>
  `;
}

const cipherItemRowStyles = ({ theme }: { theme: Theme }) => css`
  ${typography.body1}

  gap: ${spacing["2"]};
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-width: 0 0 0.5px 0;
  border-style: solid;
  border-radius: ${spacing["2"]};
  border-color: ${themes[theme].secondary["300"]};
  background-color: ${themes[theme].background.DEFAULT};
  padding: ${spacing["2"]} ${spacing["3"]};
  min-height: min-content;
  max-height: 52px;
  overflow-x: hidden;
  white-space: nowrap;
  color: ${themes[theme].text.main};
  font-weight: 400;

  > div {
    :first-child {
      flex: 3 3 75%;
      min-width: 25%;
    }

    :not(:first-child) {
      display: flex;
      flex-direction: row;
      flex-wrap: nowrap;
      justify-content: flex-end;
      max-width: 25%;

      > button {
        max-width: min-content;
      }
    }
  }
`;
