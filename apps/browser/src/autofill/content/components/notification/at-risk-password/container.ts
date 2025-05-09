import { html } from "lit";

import { ThemeTypes } from "@bitwarden/common/platform/enums";

import {
  AtRiskPasswordNotificationParams,
  NotificationBarIframeInitData,
  NotificationType,
  NotificationTypes,
} from "../../../../notification/abstractions/notification-bar";
import { I18n } from "../../common-types";
import { notificationContainerStyles } from "../confirmation/container";
import { NotificationHeader } from "../header";

import { AtRiskNotificationBody } from "./body";
import { AtRiskNotificationFooter } from "./footer";

export type AtRiskNotificationProps = NotificationBarIframeInitData & {
  handleCloseNotification: (e: Event) => void;
} & {
  error?: string;
  i18n: I18n;
  type: NotificationType;
  params: AtRiskPasswordNotificationParams;
};

export function AtRiskNotification({
  handleCloseNotification,
  i18n,
  theme = ThemeTypes.Light,
  type,
  params,
}: AtRiskNotificationProps) {
  const headerMessage = getHeaderMessage(i18n, type);
  const { passwordChangeUri, organizationName } = params;

  return html`
    <div class=${notificationContainerStyles(theme)}>
      ${NotificationHeader({
        handleCloseNotification,
        message: headerMessage,
        theme,
      })}
      ${AtRiskNotificationBody({
        theme,
        handleOpenVault: () => {},
        confirmationMessage: chrome.i18n.getMessage(
          passwordChangeUri ? "atRiskChangePrompt" : "atRiskNavigatePrompt",
          organizationName,
        ),
      })};
      ${AtRiskNotificationFooter({
        i18n,
        theme,
        passwordChangeUri: params?.passwordChangeUri,
      })}
    </div>
  `;
}

function getHeaderMessage(i18n: I18n, type?: NotificationType) {
  return type === NotificationTypes.AtRiskPassword ? i18n.changePassword : undefined;
}
