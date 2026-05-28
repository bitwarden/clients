import createEmotion from "@emotion/css/create-instance";
import { html, nothing } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { spacing, themes } from "../../constants/styles";

import { ChangePasswordReminderMessage } from "./message";

export const componentClassPrefix = "change-password-reminder-body";

const { css } = createEmotion({
  key: componentClassPrefix,
});

export type ChangePasswordReminderBodyProps = {
  message: string;
  theme: Theme;
};

export function ChangePasswordReminderBody({ message, theme }: ChangePasswordReminderBodyProps) {
  return html`
    <div class=${changePasswordReminderBodyStyles({ theme })}>
      ${message ? ChangePasswordReminderMessage({ message, theme }) : nothing}
    </div>
  `;
}

const changePasswordReminderBodyStyles = ({ theme }: { theme: Theme }) => css`
  gap: ${spacing[4]};
  display: flex;
  align-items: center;
  justify-content: flex-start;
  background-color: ${themes[theme].background.alt};
  padding: ${spacing[3]} ${spacing[3]} ${spacing[1]} ${spacing[3]};
`;
