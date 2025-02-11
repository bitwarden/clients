import createEmotion from "@emotion/css/create-instance";
import { html } from "lit";

import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums";

import { themes } from "../constants/styles";
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
  theme = ThemeTypes.Light,
}: {
  error: string;
  buttonText: string;
  confirmationMessage?: string;
  theme: Theme;
}) {
  const IconComponent = !error ? PartyHorn : Warning;
  return html`
    <div class=${notificationConfirmationBodyStyles({ theme })}>
      <div class=${iconContainerStyles(error)}>${IconComponent({ theme })}</div>
      ${confirmationMessage
        ? NotificationConfirmationMessage({
            handleClick: () => {},
            confirmationMessage,
            theme,
            buttonText,
          })
        : null}
    </div>
  `;
}

const iconContainerStyles = (error: string) => css`
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
  white-space: nowrap;
`;
