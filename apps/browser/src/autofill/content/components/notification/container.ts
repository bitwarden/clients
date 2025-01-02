import { css } from "@emotion/css";
import { html } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import {
  NotificationBarIframeInitData,
  NotificationTypes,
} from "../../../notification/abstractions/notification-bar";
import { createAutofillOverlayCipherDataMock } from "../../../spec/autofill-mocks";
import { CipherItem } from "../cipher";
import { CipherData } from "../cipher/types";
import { themes, spacing } from "../constants/styles";
import { ActionRow } from "../rows/action-row";
import { ButtonRow } from "../rows/button-row";
import { ItemRow } from "../rows/item-row";

import { NotificationBody } from "./body";
import { NotificationFooter } from "./footer";
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

  // @TODO remove mock ciphers for development
  const ciphers = [
    createAutofillOverlayCipherDataMock(1),
    { ...createAutofillOverlayCipherDataMock(2), icon: { imageEnabled: false } },
    {
      ...createAutofillOverlayCipherDataMock(3),
      icon: { imageEnabled: true, image: "https://localhost:8443/icons/webtests.dev/icon.png" },
    },
  ] as CipherData[];
  const itemText = type === NotificationTypes.Add ? "Save as new login" : null;

  return html`
    <div class=${notificationContainerStyles(theme)}>
      ${NotificationHeader({
        handleCloseNotification,
        standalone: showBody,
        isVaultLocked,
        message: headerMessage,
        theme,
      })}
      ${showBody
        ? NotificationBody({
            theme,
            customClasses: [notificationBodyClass],
            // @TODO move notificationType to `NotificationBody` component
            children: ciphers.map((cipher) =>
              ItemRow({
                theme,
                children: CipherItem({
                  cipher,
                  notificationType: type,
                  theme,
                  handleAction: () => {},
                }),
              }),
            ),
          })
        : null}
      ${NotificationFooter({
        theme,
        children: [
          type === NotificationTypes.Change
            ? ActionRow({ itemText, handleAction: () => {}, theme })
            : ButtonRow({ theme }),
        ],
      })}
    </div>
  `;
}

// @TODO use emotion css class composition
const notificationBodyClass = "notification-body";

const notificationContainerStyles = (theme: Theme) => css`
  position: absolute;
  right: 20px;
  border: 1px solid ${themes[theme].secondary["300"]};
  border-radius: ${spacing["4"]};
  box-shadow: -2px 4px 6px 0px #0000001a;
  background-color: ${themes[theme].background.alt};
  width: 400px;

  > [class*="notification-header-"] {
    border-radius: ${spacing["4"]} ${spacing["4"]} 0 0;
  }

  > .${notificationBodyClass} {
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
