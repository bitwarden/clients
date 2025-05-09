import { css } from "@emotion/css";
import { html } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { ActionButton } from "../../buttons/action-button";
import { AdditionalTasksButtonContent } from "../../buttons/additional-tasks/button-content";
import { I18n } from "../../common-types";
import { notificationFooterStyles } from "../footer";

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
    <div class=${[maxWidthMinContent, notificationFooterStyles({ theme })]}>
      ${ActionButton({
        handleClick: handleButtonClick,
        buttonText: AdditionalTasksButtonContent({ buttonText: primaryButtonText, theme }),
        theme,
      })}
    </div>
  `;
}

const maxWidthMinContent = css`
  max-width: min-content;
`;
