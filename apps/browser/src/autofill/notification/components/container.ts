import { css } from "@emotion/css";
import { html } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { createAutofillOverlayCipherDataMock } from "../../spec/autofill-mocks";
import { NotificationBarIframeInitData, NotificationTypes } from "../abstractions/notification-bar";
import { themes, spacing } from "../constants/styles";
import { CipherData } from "../types";

import { NotificationBody } from "./body";
import { CipherItem } from "./cipher";
import { NotificationFooter } from "./footer";
import { NotificationHeader } from "./header";
import { ActionRow } from "./rows/action-row";
import { ButtonRow } from "./rows/button-row";
import { ItemRow } from "./rows/item-row";

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

  // @TODO remove mock cipher for development
  const cipher = createAutofillOverlayCipherDataMock(1) as CipherData;

  const itemText = type === NotificationTypes.Add ? "Save as new login" : null;

  return html`
    <div class=${notificationContainerStyles(theme)}>
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
            // @TODO move notificationType to `NotificationBody` component
            children: [
              // @TODO placeholder composition
              ItemRow({
                theme,
                children: CipherItem({
                  cipher,
                  notificationType: type,
                  theme,
                  handleAction: () => {},
                }),
              }),
              ItemRow({ theme, children: CipherItem({ cipher, notificationType: type, theme }) }),
              ItemRow({
                theme,
                children: CipherItem({
                  cipher,
                  notificationType: type,
                  theme,
                  handleAction: () => {},
                }),
              }),
            ],
          })
        : null}
      ${NotificationFooter({
        theme,
        children: [
          NotificationTypes.Change
            ? ButtonRow({ theme })
            : ActionRow({ itemText, handleAction: () => {}, theme }),
        ],
      })}
    </div>
  `;
}

const notificationContainerStyles = (theme: Theme) => css`
  position: absolute;
  right: 20px;
  border: 1px solid ${themes[theme].secondary["300"]};
  border-radius: ${spacing["4"]};
  box-shadow: -2px 4px 6px 0px #0000001a;
  background-color: ${themes[theme].background.alt};
  width: 400px;

  > .notification-body {
    margin: ${spacing["3"]} 0 ${spacing["1.5"]} ${spacing["3"]};
    padding-right: ${spacing["3"]};
  }
`;

function getHeaderMessage(type: string, i18n: { [key: string]: string }) {
  switch (type) {
    case NotificationTypes.Add:
      return i18n.saveAsNewLoginAction;
    case NotificationTypes.Change:
      return i18n.updateLoginPrompt;
    case NotificationTypes.Unlock:
      return "";
    case NotificationTypes.FilelessImport:
      return "";
    default:
      return null;
  }
}
