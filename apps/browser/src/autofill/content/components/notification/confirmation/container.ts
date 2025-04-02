import { css } from "@emotion/css";
import { html, nothing } from "lit";

import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums";

import {
  NotificationBarIframeInitData,
  NotificationTaskInfo,
  NotificationType,
  NotificationTypes,
} from "../../../../notification/abstractions/notification-bar";
import { themes, spacing } from "../../constants/styles";
import {
  NotificationHeader,
  componentClassPrefix as notificationHeaderClassPrefix,
} from "../header";

import { NotificationConfirmationBody } from "./body";
import { NotificationConfirmationFooter } from "./footer";

export type NotificationConfirmationContainerProps = NotificationBarIframeInitData & {
  handleCloseNotification: (e: Event) => void;
  handleOpenVault: (e: Event) => void;
} & {
  error?: string;
  i18n: { [key: string]: string };
  task?: NotificationTaskInfo;
  type: NotificationType;
  username: string;
};

export function NotificationConfirmationContainer({
  error,
  handleCloseNotification,
  handleOpenVault,
  i18n,
  task,
  theme = ThemeTypes.Light,
  type,
  username,
}: NotificationConfirmationContainerProps) {
  const headerMessage = getHeaderMessage(i18n, type, error);
  const confirmationMessage = getConfirmationMessage(i18n, username, type, error);
  const buttonText = error ? i18n.newItem : i18n.view;

  let messageDetails: string | undefined;
  let remainingTasksCount: number | undefined;
  let tasksAreComplete: boolean = false;

  if (task) {
    remainingTasksCount = task.remainingTasksCount || 0;
    tasksAreComplete = remainingTasksCount === 0;

    messageDetails =
      remainingTasksCount > 0
        ? chrome.i18n.getMessage("loginUpdateTaskSuccessAdditional", [
            task.orgName,
            `${remainingTasksCount}`,
          ])
        : chrome.i18n.getMessage("loginUpdateTaskSuccess", [task.orgName]);
  }

  return html`
    <div class=${notificationContainerStyles(theme)}>
      ${NotificationHeader({
        handleCloseNotification,
        message: headerMessage,
        theme,
      })}
      ${NotificationConfirmationBody({
        buttonText,
        confirmationMessage,
        tasksAreComplete,
        messageDetails,
        theme,
        handleOpenVault,
      })}
      ${remainingTasksCount
        ? NotificationConfirmationFooter({
            i18n,
            theme,
          })
        : nothing}
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
  overflow: hidden;

  [class*="${notificationHeaderClassPrefix}-"] {
    border-radius: ${spacing["4"]} ${spacing["4"]} 0 0;
    border-bottom: 0.5px solid ${themes[theme].secondary["300"]};
  }
`;

function getConfirmationMessage(
  i18n: { [key: string]: string },
  username: string,
  type?: NotificationType,
  error?: string,
) {
  // const loginSaveSuccessDetails = chrome.i18n.getMessage("loginSaveSuccessDetails", [username]);
  // const loginUpdatedSuccessDetails = chrome.i18n.getMessage("loginUpdatedSuccessDetails", [
  //   username,
  // ]);
  const loginSaveSuccessDetails = `${username} saved to Bitwarden.`;
  const loginUpdatedSuccessDetails = `${username} updated in Bitwarden.`;

  if (error) {
    return i18n.saveFailureDetails;
  }
  return type === "add" ? loginSaveSuccessDetails : loginUpdatedSuccessDetails;
}

function getHeaderMessage(
  i18n: { [key: string]: string },
  type?: NotificationType,
  error?: string,
) {
  if (error) {
    return i18n.saveFailure;
  }

  switch (type) {
    case NotificationTypes.Add:
      return i18n.loginSaveSuccess;
    case NotificationTypes.Change:
      return i18n.loginUpdateSuccess;
    case NotificationTypes.Unlock:
      return "";
    default:
      return undefined;
  }
}
