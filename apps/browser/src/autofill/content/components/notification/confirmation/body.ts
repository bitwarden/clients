import createEmotion from "@emotion/css/create-instance";
import { html, nothing } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { NotificationTaskInfo } from "../../../../notification/abstractions/notification-bar";
import { themes } from "../../constants/styles";
import { PartyHorn, Warning } from "../../icons";

import { NotificationConfirmationMessage } from "./message";

export const componentClassPrefix = "notification-confirmation-body";

const { css } = createEmotion({
  key: componentClassPrefix,
});

export type NotificationConfirmationBodyProps = {
  error?: string;
  buttonText: string;
  confirmationMessage: string;
  task?: NotificationTaskInfo;
  theme: Theme;
  handleOpenVault: (e: Event) => void;
};

export function NotificationConfirmationBody({
  buttonText,
  error,
  confirmationMessage,
  task,
  theme,
  handleOpenVault,
}: NotificationConfirmationBodyProps) {
  const IconComponent = !error ? PartyHorn : Warning;

  let messageDetails: string | undefined;

  if (task) {
    const remainingTasksCount = task.remainingTasksCount || 0;

    messageDetails =
      remainingTasksCount > 0
        ? chrome.i18n.getMessage("loginUpdateTaskSuccessAdditional", [
            task.orgName,
            remainingTasksCount,
          ])
        : chrome.i18n.getMessage("loginUpdateTaskSuccess", [task.orgName]);
  }

  const showConfirmationMessage = confirmationMessage || buttonText || messageDetails;

  return html`
    <div class=${notificationConfirmationBodyStyles({ theme })}>
      <div class=${iconContainerStyles(error)}>${IconComponent({ theme })}</div>
      ${showConfirmationMessage
        ? NotificationConfirmationMessage({
            handleClick: handleOpenVault,
            message: confirmationMessage,
            messageDetails,
            theme,
            buttonText,
          })
        : nothing}
    </div>
  `;
}

const iconContainerStyles = (error?: string) => css`
  > svg {
    width: ${!error ? "50px" : "40px"};
    height: fit-content;
  }
`;
const notificationConfirmationBodyStyles = ({ theme }: { theme: Theme }) => css`
  gap: 16px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  background-color: ${themes[theme].background.alt};
  padding: 12px;
`;
