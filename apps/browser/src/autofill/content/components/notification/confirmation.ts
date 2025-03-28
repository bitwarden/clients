import createEmotion from "@emotion/css/create-instance";
import { html, nothing } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { NotificationTaskInfo } from "../../../notification/abstractions/notification-bar";
import { themes, typography } from "../constants/styles";
import { PartyHorn, Warning } from "../icons";

import { NotificationConfirmationMessage } from "./confirmation-message";

export const componentClassPrefix = "notification-confirmation-body";

const { css } = createEmotion({
  key: componentClassPrefix,
});

export function NotificationConfirmationBody({
  buttonText,
  error,
  confirmationMessage,
  task,
  theme,
  handleOpenVault,
}: {
  error?: string;
  buttonText: string;
  confirmationMessage: string;
  task?: NotificationTaskInfo;
  theme: Theme;
  handleOpenVault: (e: Event) => void;
}) {
  const IconComponent = !error ? PartyHorn : Warning;
  return html`
    <div class=${notificationConfirmationBodyStyles({ theme })}>
      <div class=${iconContainerStyles(error)}>${IconComponent({ theme })}</div>
      ${confirmationMessage && buttonText
        ? NotificationConfirmationMessage({
            handleClick: handleOpenVault,
            children: task?.taskCompleted
              ? html`<div class=${AdditionalMessageStyles({ theme })}>
                  Thank you for making ${task.orgName || "your organization"} more secure. You have
                  ${task.remainingTasksCount} more passwords to update.
                </div>`
              : nothing,
            confirmationMessage,
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

const AdditionalMessageStyles = ({ theme }: { theme: Theme }) => css`
  ${typography.body2}

  font-size: 14px;
  color: ${themes[theme].text.muted};
`;
