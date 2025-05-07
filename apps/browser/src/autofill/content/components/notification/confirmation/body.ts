import createEmotion from "@emotion/css/create-instance";
import { html, nothing } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { themes } from "../../constants/styles";
import { Celebrate, Keyhole, Warning } from "../../illustrations";

import { NotificationConfirmationMessage } from "./message";

export const componentClassPrefix = "notification-confirmation-body";

const { css } = createEmotion({
  key: componentClassPrefix,
});

export type NotificationConfirmationBodyProps = {
  buttonAria: string;
  buttonText: string;
  confirmationMessage: string;
  error?: string;
  messageDetails?: string;
  tasksAreComplete?: boolean;
  theme: Theme;
  handleOpenVault: () => void;
};

export function NotificationConfirmationBody({
  buttonAria,
  buttonText,
  confirmationMessage,
  error,
  messageDetails,
  tasksAreComplete,
  theme,
  handleOpenVault,
}: NotificationConfirmationBodyProps) {
  const IconComponent = tasksAreComplete ? Keyhole : !error ? Celebrate : Warning;

  const showConfirmationMessage = confirmationMessage || buttonText || messageDetails;

  return html`
    <div class=${notificationConfirmationBodyStyles({ theme })}>
      <div class=${iconContainerStyles(error)}>${IconComponent({ theme })}</div>
      ${showConfirmationMessage
        ? NotificationConfirmationMessage({
            buttonAria,
            buttonText,
            message: confirmationMessage,
            messageDetails,
            theme,
            handleClick: handleOpenVault,
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
