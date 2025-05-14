import { css } from "@emotion/css";
import { html } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { ActionButton } from "../../buttons/action-button";
import { I18n } from "../../common-types";
import { spacing, themes } from "../../constants/styles";
import { ExternalLink } from "../../icons";

export type NotificationConfirmationFooterProps = {
  i18n: I18n;
  theme: Theme;
  handleButtonClick: (event: Event) => void;
};

export function NotificationConfirmationFooter({
  i18n,
  theme,
  handleButtonClick,
}: NotificationConfirmationFooterProps) {
  const primaryButtonText = i18n.nextSecurityTaskAction;

  return html`
    <div class=${notificationConfirmationFooterStyles({ theme })}>
      ${ActionButton({
        handleClick: handleButtonClick,
        buttonText: AdditionalTasksButtonContent({ buttonText: primaryButtonText, theme }),
        theme,
      })}
    </div>
  `;
}

const notificationConfirmationFooterStyles = ({ theme }: { theme: Theme }) => css`
  background-color: ${themes[theme].background.alt};
  padding: 0 ${spacing[3]} ${spacing[3]} ${spacing[3]};
  max-width: min-content;

  :last-child {
    border-radius: 0 0 ${spacing["4"]} ${spacing["4"]};
    padding-bottom: ${spacing[4]};
  }
`;

function AdditionalTasksButtonContent({ buttonText, theme }: { buttonText: string; theme: Theme }) {
  return html`
    <div class=${additionalTasksButtonContentStyles({ theme })}>
      <span>${buttonText}</span>
      ${ExternalLink({ theme, color: themes[theme].text.contrast })}
    </div>
  `;
}

const additionalTasksButtonContentStyles = ({ theme }: { theme: Theme }) => css`
  gap: ${spacing[2]};
  display: flex;
  align-items: center;
  white-space: nowrap;
`;
