import { css } from "@emotion/css";
import { html } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { buildIconColorRule, ruleNames, themes } from "../constants/styles";

export function Close({
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
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none">
      <path
        class=${css(buildIconColorRule(shapeColor, ruleNames.fill))}
        d="m19.809 19.21-8.487-8.226a.592.592 0 0 1 0-.852l8.382-8.13a.594.594 0 0 0 .175-.423.593.593 0 0 0-.182-.42.632.632 0 0 0-.872-.007l-8.383 8.126a.634.634 0 0 1-.88 0l-8.41-8.135a.642.642 0 0 0-.887-.008.602.602 0 0 0-.182.431.588.588 0 0 0 .19.428l8.41 8.139a.592.592 0 0 1 0 .852l-8.5 8.225a.605.605 0 0 0-.183.427c0 .16.066.313.183.426a.635.635 0 0 0 .88-.001l8.5-8.226a.635.635 0 0 1 .88 0l8.488 8.226a.64.64 0 0 0 .887.008.605.605 0 0 0 .182-.43.591.591 0 0 0-.19-.429h-.001Z"
      />
    </svg>
  `;
}
