import { css } from "@emotion/css";
import { html, TemplateResult } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { spacing, themes } from "../constants/styles";

export function NotificationFooter({
  theme,
  children,
}: {
  theme: Theme;
  children: TemplateResult[];
}) {
  return html` <div class=${notificationFooterStyles({ theme })}>${children}</div> `;
}

const notificationFooterStyles = ({ theme }: { theme: Theme }) => css`
  display: flex;
  background-color: ${themes[theme].background.alt};
  padding: 0 ${spacing[3]} ${spacing[3]} ${spacing[3]};

  :last-child {
    border-radius: 0 0 ${spacing["4"]} ${spacing["4"]};
  }
`;
