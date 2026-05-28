import createEmotion from "@emotion/css/create-instance";
import { html } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { I18n } from "../../common-types";
import { spacing, themes, typography } from "../../constants/styles";
import { ExternalLink } from "../../icons";

export const componentClassPrefix = "change-password-reminder-tip";

const { css } = createEmotion({
  key: componentClassPrefix,
});

export const GENERATOR_HELP_URL =
  "https://bitwarden.com/help/generator/#tab-browser-extension-6xKx6UelBVUbCceB9IupEa";

export type ChangePasswordReminderTipProps = {
  i18n: I18n;
  theme: Theme;
};

export function ChangePasswordReminderTip({ i18n, theme }: ChangePasswordReminderTipProps) {
  return html`
    <p class=${tipStyles(theme)}>
      ${i18n.changePasswordReminderTip}
      <a
        class=${tipLinkStyles(theme)}
        href=${GENERATOR_HELP_URL}
        target="_blank"
        rel="noopener noreferrer"
      >
        <span>${i18n.learnMore}</span>
        ${ExternalLink({ theme, color: themes[theme].primary["600"] })}
      </a>
    </p>
  `;
}

const tipStyles = (theme: Theme) => css`
  ${typography.body2}

  margin: 0;
  padding: ${spacing[2]} ${spacing[3]} ${spacing[3]} ${spacing[3]};
  color: ${themes[theme].text.muted};
  background-color: ${themes[theme].background.alt};
  font-weight: 400;
`;

const tipLinkStyles = (theme: Theme) => css`
  display: inline-flex;
  align-items: center;
  gap: ${spacing[1]};
  margin-left: ${spacing[1]};
  color: ${themes[theme].primary["600"]};
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;

  svg {
    width: 12px;
    height: 12px;
  }

  :hover {
    text-decoration: underline;
  }

  :focus-visible {
    outline: 2px solid ${themes[theme].primary["600"]};
    outline-offset: 2px;
    border-radius: 2px;
  }
`;
