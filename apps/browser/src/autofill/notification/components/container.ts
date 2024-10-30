import { css } from "@emotion/css";
import { html } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { NotificationBarIframeInitData } from "../abstractions/notification-bar";
import { themes, spacing } from "../constants/styles";

import { ButtonRow } from "./Buttons/button-row";
import { NotificationBody } from "./body";
import { NotificationHeader } from "./header";

export function NotificationContainer({
  handleCloseNotification,
  i18n,
  isVaultLocked,
  theme,
  type,
}: { handleCloseNotification: (e: Event) => void } & {
  i18n: { [key: string]: string };
} & NotificationBarIframeInitData) {
  const headerMessage = getHeaderMessage(type, i18n);
  const showBody = true;

  return html`
    <div class=${wrapperStyles(theme)}>
      ${NotificationHeader({
        handleCloseNotification,
        hasBody: showBody,
        isVaultLocked,
        message: headerMessage,
        theme,
      })}
      ${showBody
        ? NotificationBody({
            theme,
            children: [ButtonRow({ theme })],
          })
        : null}
    </div>
  `;
}

const wrapperStyles = (theme: Theme) => css`
  position: absolute;
  right: 20px;
  border: 1px solid ${themes[theme].secondary["300"]};
  border-radius: ${spacing["4"]};
  box-shadow: -2px 4px 6px 0px #0000001a;
  background: ${themes[theme].background.DEFAULT};
  width: 400px;
`;

function getHeaderMessage(type: string, i18n: { [key: string]: string }) {
  switch (type) {
    case "add":
      return i18n.saveAsNewLoginAction;
    case "change":
      return i18n.updateLoginPrompt;
    case "unlock":
      return "";
    case "fileless-import":
      return "";
    default:
      return null;
  }
}
