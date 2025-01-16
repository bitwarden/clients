import { css } from "@emotion/css";
import { html } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { buildIconColorRule, ruleNames, themes } from "../constants/styles";

export function Shield({ color, theme }: { color?: string; theme: Theme }) {
  const shapeColor = color || themes[theme].brandLogo;

  return html`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 24" fill="none">
      <path
        class=${css(buildIconColorRule(shapeColor, ruleNames.fill))}
        d="M19.703.3A.97.97 0 0 0 19 0H1a.958.958 0 0 0-.702.3.962.962 0 0 0-.3.702v12c.004.913.18 1.818.522 2.665a9.95 9.95 0 0 0 1.297 2.345c.552.72 1.169 1.387 1.844 1.993a21.721 21.721 0 0 0 1.975 1.61c.6.426 1.23.83 1.89 1.21.66.381 1.126.639 1.398.773.275.135.497.241.662.312.129.062.27.093.414.09a.87.87 0 0 0 .406-.095c.168-.073.387-.177.665-.312.277-.135.75-.393 1.398-.772.648-.38 1.285-.785 1.89-1.21.69-.499 1.35-1.036 1.978-1.61a14.458 14.458 0 0 0 1.844-1.994c.535-.72.972-1.508 1.297-2.344a7.185 7.185 0 0 0 .522-2.666v-12A.944.944 0 0 0 19.703.3Zm-2.32 12.811c0 4.35-7.382 8.087-7.382 8.087V2.57h7.381v10.54Z"
      />
    </svg>
  `;
}
