import { css } from "@emotion/css";
import { html } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { createAutofillOverlayCipherDataMock } from "../../spec/autofill-mocks";
import { NotificationBarIframeInitData } from "../abstractions/notification-bar";
import { themes, spacing } from "../constants/styles";
import { CipherData } from "../types";

import { ActionRow } from "./action-row";
import { NotificationBody } from "./body";
import { ButtonRow } from "./buttons/button-row";
import { CipherItem } from "./cipher";
import { NotificationFooter } from "./footer";
import { NotificationHeader } from "./header";
import { ItemRow } from "./item-row";

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
  const actionType = "newLogin";
  const itemText = actionType === "newLogin" ? "Save as new login" : null;

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
              ItemRow({ theme, children: CipherItem({ cipher, notificationType: "add", theme }) }),
              ActionRow({ itemText, handleAction: () => {}, theme }),
              ItemRow({ theme, children: CipherItem({ cipher, notificationType: "add", theme }) }),
            ],
          })
        : null}
      ${NotificationFooter({ theme, children: [ButtonRow({ theme })] })}
    </div>
  `;
}

const notificationContainerStyles = (theme: Theme) => css`
  position: absolute;
  right: 20px;
  border: 1px solid ${themes[theme].secondary["300"]};
  border-radius: ${spacing["4"]};
  box-shadow: -2px 4px 6px 0px #0000001a;
  background: ${themes[theme].background.DEFAULT};
  width: 400px;
`;

function getHeaderMessage(type: string, i18n: { [key: string]: string }) {
  // @TODO create constants/types for `type`
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
