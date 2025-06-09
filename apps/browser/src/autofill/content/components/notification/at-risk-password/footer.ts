import { css } from "@emotion/css";
import { html } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { ActionButton } from "../../buttons/action-button";
import { AdditionalTasksButtonContent } from "../../buttons/additional-tasks/button-content";
import { I18n } from "../../common-types";
import { spacing } from "../../constants/styles";

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
  return html`<div class=${atRiskNotificationFooterStyles}>
    ${passwordChangeUri &&
    ActionButton({
      handleClick: () => {
        open(passwordChangeUri, "_blank");
      },
      buttonText: AdditionalTasksButtonContent({ buttonText: i18n.changePassword, theme }),
      theme,
      fullWidth: false,
    })}
  </div>`;
}

const atRiskNotificationFooterStyles = css`
  display: flex;
  padding: ${spacing[2]} ${spacing[4]} ${spacing[4]} ${spacing[4]};

  :last-child {
    border-radius: 0 0 ${spacing["4"]} ${spacing["4"]};
  }
`;
