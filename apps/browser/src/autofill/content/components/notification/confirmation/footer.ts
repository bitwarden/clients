import { css } from "@emotion/css";
import { html } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { spacing, themes } from "../../constants/styles";
import { ButtonRow } from "../../rows/button-row";

export type NotificationConfirmationFooterProps = {
  i18n: { [key: string]: string };
  theme: Theme;
};

export function NotificationConfirmationFooter({
  i18n,
  theme,
}: NotificationConfirmationFooterProps) {
  const primaryButtonText = i18n.nextSecurityTaskAction;

  // @TODO link to followup tasks
  const handleButtonClick = () => {};

  return html`
    <div class=${notificationConfirmationFooterStyles({ theme })}>
      ${ButtonRow({
        primaryButton: {
          handlePrimaryButtonClick: handleButtonClick,
          text: primaryButtonText,
        },
        theme,
      })}
    </div>
  `;
}

const notificationConfirmationFooterStyles = ({ theme }: { theme: Theme }) => css`
  display: flex;
  background-color: ${themes[theme].background.alt};
  padding: 0 ${spacing[3]} ${spacing[3]} ${spacing[3]};

  :last-child {
    border-radius: 0 0 ${spacing["4"]} ${spacing["4"]};
    padding-bottom: ${spacing[4]};
  }
`;
