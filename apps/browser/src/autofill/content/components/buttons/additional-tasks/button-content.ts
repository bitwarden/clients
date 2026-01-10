import { css } from "@emotion/css";
import { html } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { spacing, themes } from "../../constants/styles";
import { ExternalLink } from "../../icons";

export function AdditionalTasksButtonContent({
  buttonText,
  theme,
}: {
  buttonText: string;
  theme: Theme;
}) {
  return html`
    <div class=${additionalTasksButtonContentStyles({ theme })}>
      <span>${buttonText}</span>
      ${ExternalLink({ theme, color: themes[theme].text.contrast })}
    </div>
  `;
}

export const additionalTasksButtonContentStyles = ({ theme }: { theme: Theme }) => css`
  gap: ${spacing[2]};
  display: flex;
  align-items: center;
  white-space: nowrap;
`;
