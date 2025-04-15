import { css } from "@emotion/css";
import { html } from "lit";

import { IconProps } from "../common-types";
import { buildIconColorRule, ruleNames, themes } from "../constants/styles";

export function Collection({ color, disabled, theme }: IconProps) {
  const shapeColor = disabled ? themes[theme].secondary["300"] : color || themes[theme].text.main;

  return html`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 17 14" fill="none">
      <path
        class=${css(buildIconColorRule(shapeColor, ruleNames.fill))}
        d="M14.92 13.91H1.92c-.4 0-.78-.16-1.06-.44A1.49 1.49 0 0 1 .42 12.42V4.84c0-.4.16-.78.44-1.06.28-.28.66-.44 1.06-.44H14.92c.4 0 .78.16 1.06.44.28.28.44.66.44 1.06v7.58c0 .4-.16.78-.44 1.06-.28.28-.66.44-1.06.44ZM1.92 4.34a.5.5 0 0 0-.35.15.5.5 0 0 0-.15.35v7.58c0 .07.01.13.04.2.02.06.06.11.11.16.05.05.1.08.16.11.06.03.13.05.2.05H14.92c.07 0 .13-.02.2-.05.06-.03.11-.06.16-.11.05-.05.08-.1.11-.16.03-.06.04-.13.04-.2V4.84a.5.5 0 0 0-.15-.35.5.5 0 0 0-.35-.15L1.92 4.34ZM14.59 2.39H2.11a.34.34 0 0 1 0-.69h12.48a.34.34 0 0 1 0 .69ZM13.83.79H2.87a.35.35 0 0 1 0-.7h10.96a.35.35 0 0 1 0 .7Z"
      />
    </svg>
  `;
}
