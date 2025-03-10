import { css } from "@emotion/css";
import { html } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { buildIconColorRule, ruleNames, themes } from "../constants/styles";

export function User({
  color,
  disabled,
  theme,
}: {
  color?: string;
  disabled?: boolean;
  theme: Theme;
}) {
  const shapeColor = disabled ? themes[theme].secondary["300"] : color || themes[theme].text.main;

  return html`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
      <path
        class=${css(buildIconColorRule(shapeColor, ruleNames.fill))}
        d="M23.16 20.895a11.343 11.343 0 0 0-7.756-8.425 6.624 6.624 0 0 0 3.374-5.74 6.73 6.73 0 1 0-13.46 0 6.624 6.624 0 0 0 3.343 5.722 11.334 11.334 0 0 0-7.82 8.443A2.57 2.57 0 0 0 3.362 24h17.274a2.573 2.573 0 0 0 2.523-3.106v.001ZM6.933 6.73a5.12 5.12 0 0 1 3.12-4.766 5.115 5.115 0 0 1 4.845 8.962 5.114 5.114 0 0 1-2.848.866A5.097 5.097 0 0 1 6.933 6.73v.001ZM21.38 22.053a.94.94 0 0 1-.748.35H3.363a.938.938 0 0 1-.74-.35.986.986 0 0 1-.204-.833A9.812 9.812 0 0 1 12 13.516a9.807 9.807 0 0 1 9.581 7.704.98.98 0 0 1-.202.833Z"
      />
    </svg>
  `;
}
