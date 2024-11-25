import { css } from "@emotion/css";
import { html, TemplateResult } from "lit";

import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums";

import { scrollbarStyles, spacing, themes, typography } from "../constants/styles";

export function NotificationBody({
  theme = ThemeTypes.Light,
  children,
}: {
  theme: Theme;
  children: TemplateResult[];
}) {
  // @TODO get client vendor from context
  const isSafari = false;

  return html` <div class=${notificationBodyStyles({ isSafari, theme })}>${children}</div> `;
}

const notificationBodyStyles = ({ isSafari, theme }: { isSafari: boolean; theme: Theme }) => css`
  ${typography.body1}

  gap: ${spacing["1.5"]};
  display: flex;
  flex-flow: column;
  background-color: ${themes[theme].background.alt};
  padding: ${spacing["3"]};
  max-height: 123px;
  overflow-x: hidden;
  overflow-y: auto;
  white-space: nowrap;
  color: ${themes[theme].text.main};
  font-weight: 400;

  :last-child {
    border-radius: 0 0 ${spacing["4"]} ${spacing["4"]};
  }

  ${isSafari ? scrollbarStyles(theme).safari : scrollbarStyles(theme).default}
`;
