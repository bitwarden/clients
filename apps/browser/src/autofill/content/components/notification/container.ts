import { css } from "@emotion/css";
import { html, nothing } from "lit";

import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums";

import {
  NotificationBarIframeInitData,
  NotificationTypes,
  NotificationType,
} from "../../../notification/abstractions/notification-bar";
import { NotificationCipherData } from "../cipher/types";
import { CollectionNotificationView, FolderView, I18n, OrgView } from "../common-types";
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
  collections?: CollectionNotificationView[];
  folders?: FolderView[];
  headerMessage?: string;
  i18n: I18n;
  isLoading?: boolean;
  organizations?: OrgView[];
  personalVaultIsAllowed?: boolean;
  notificationTestId: string;
  type: NotificationType; // @TODO typing override for generic `NotificationBarIframeInitData.type`
};

export function NotificationContainer({
  handleCloseNotification,
  handleEditOrUpdateAction,
  handleSaveAction,
  ciphers,
  collections,
  folders,
  headerMessage,
  i18n,
  isLoading,
  organizations,
  personalVaultIsAllowed = true,
  notificationTestId,
  theme = ThemeTypes.Light,
  type,
}: NotificationContainerProps) {
  const showBody = type !== NotificationTypes.Unlock;

  return html`
    <div data-testid="${notificationTestId}" class=${notificationContainerStyles(theme)}>
      ${NotificationHeader({
        handleCloseNotification,
        i18n,
        message: headerMessage,
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
        : nothing}
      ${NotificationFooter({
        handleSaveAction,
        collections,
        folders,
        i18n,
        isLoading,
        notificationType: type,
        organizations,
        personalVaultIsAllowed,
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
    margin: ${spacing["3"]} 0 0 ${spacing["3"]};
    padding-right: ${spacing["3"]};
  }
`;
