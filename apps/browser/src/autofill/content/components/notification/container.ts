import { css } from "@emotion/css";
import { html } from "lit";

import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums";

import {
  NotificationBarIframeInitData,
  NotificationTypes,
  NotificationType,
} from "../../../notification/abstractions/notification-bar";
import { NotificationCipherData } from "../cipher/types";
import { FolderView, OrgView } from "../common-types";
import { themes, spacing } from "../constants/styles";

import { NotificationBody, componentClassPrefix as notificationBodyClassPrefix } from "./body";
import { NotificationFooter } from "./footer";
import {
  NotificationHeader,
  componentClassPrefix as notificationHeaderClassPrefix,
} from "./header";

export type NotificationContainerProps = NotificationBarIframeInitData & {
  handleCloseNotification: (e: Event) => void;
  handleSaveAction: (e: Event) => void;
  handleEditOrUpdateAction: (e: Event) => void;
} & {
  ciphers?: NotificationCipherData[];
  folders?: FolderView[];
  i18n: { [key: string]: string };
  organizations?: OrgView[];
  type: NotificationType; // @TODO typing override for generic `NotificationBarIframeInitData.type`
};

export function NotificationContainer({
  handleCloseNotification,
  handleEditOrUpdateAction,
  handleSaveAction,
  ciphers,
  folders,
  i18n,
  organizations,
  theme = ThemeTypes.Light,
  type,
}: NotificationContainerProps) {
  const headerMessage = getHeaderMessage(i18n, type);
  const showBody = true;

  return html`
    <div class=${notificationContainerStyles(theme)}>
      ${NotificationHeader({
        handleCloseNotification,
        message: headerMessage,
        standalone: showBody,
        theme,
      })}
      ${showBody
        ? NotificationBody({
            handleEditOrUpdateAction,
            ciphers,
            notificationType: type,
            theme,
            i18n,
          })
        : null}
      ${NotificationFooter({
        handleSaveAction,
        folders,
        i18n,
        notificationType: type,
        organizations,
        theme,
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

  [class*="${notificationHeaderClassPrefix}-"] {
    border-radius: ${spacing["4"]} ${spacing["4"]} 0 0;
  }

  [class*="${notificationBodyClassPrefix}-"] {
    margin: ${spacing["3"]} 0 ${spacing["1.5"]} ${spacing["3"]};
    padding-right: ${spacing["3"]};
  }
`;

function getHeaderMessage(i18n: { [key: string]: string }, type?: NotificationType) {
  switch (type) {
    case NotificationTypes.Add:
      return i18n.saveLogin;
    case NotificationTypes.Change:
      return i18n.updateLogin;
    case NotificationTypes.Unlock:
      return "";
    default:
      return undefined;
  }
}
