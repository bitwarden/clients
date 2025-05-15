import { html } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { ActionButton } from "../../buttons/action-button";
import { AdditionalTasksButtonContent } from "../../buttons/additional-tasks/button-content";
import { I18n } from "../../common-types";
// Utilizes default notification styles, not confirmation.
import { notificationFooterStyles } from "../footer";

export type AtRiskNotificationFooterProps = {
  i18n: I18n;
  theme: Theme;
  passwordChangeUri: string;
};

export function AtRiskNotificationFooter({
  i18n,
  theme,
  passwordChangeUri,
}: AtRiskNotificationFooterProps) {
  return html`<div class=${notificationFooterStyles({ isChangeNotification: false })}>
    ${passwordChangeUri &&
    ActionButton({
      handleClick: () => {
        open("https://" + passwordChangeUri, "_blank");
      },
      buttonText: AdditionalTasksButtonContent({ buttonText: i18n.changePassword, theme }),
      theme,
      fullWidth: false,
    })}
  </div>`;
}
