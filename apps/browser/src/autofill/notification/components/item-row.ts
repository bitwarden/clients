import { css } from "@emotion/css";
import { html, TemplateResult } from "lit";

import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums";

import { spacing, themes, typography } from "../constants/styles";

export function ItemRow({
  theme = ThemeTypes.Light,
  children,
}: {
  theme: Theme;
  children: TemplateResult[];
}) {
  return html` <div class=${rowStyles({ theme })}>${children}</div> `;
}

export const rowStyles = ({ theme }: { theme: Theme }) => css`
  ${typography.body1}

  gap: ${spacing["2"]};
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-radius: ${spacing["2"]};
  background-color: ${themes[theme].background.DEFAULT};
  padding: ${spacing["2"]} ${spacing["3"]};
  max-height: 52px;
  white-space: nowrap;
  color: ${themes[theme].text.main};
  font-weight: 400;
`;
