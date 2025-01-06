import { css } from "@emotion/css";
import { html } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { buildIconColorRule, ruleNames, themes } from "../constants/styles";

export function Business({
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
        fill-rule="evenodd"
        d="M6.015 16.482a3.007 3.007 0 1 0 0-6.015 3.007 3.007 0 0 0 0 6.015Zm0 1.504a4.51 4.51 0 1 0 0-9.022 4.51 4.51 0 0 0 0 9.022Z"
        clip-rule="evenodd"
      />
      <path
        class=${css(buildIconColorRule(shapeColor, ruleNames.fill))}
        fill-rule="evenodd"
        d="M10.439 22.497c-.548-2.805-2.51-4.511-4.427-4.511-1.917 0-3.879 1.706-4.426 4.51h8.853Zm-8.934.525v-.002.002ZM.659 24h10.466c.645 0 .984-.424.888-1.18-.457-3.591-2.97-6.338-6-6.338-3.032 0-5.544 2.747-6.001 6.339-.066.511.143 1.18.647 1.18Z"
        clip-rule="evenodd"
      />
      <path
        class=${css(buildIconColorRule(shapeColor, ruleNames.fill))}
        fill-rule="evenodd"
        d="M7.46 1.387v7.577a.694.694 0 1 1-1.387 0V.97c0-.536.434-.971.97-.971H23.03c.536 0 .971.435.971.971v20.496a.971.971 0 0 1-.971.971h-11a.694.694 0 0 1 0-1.387h10.584V1.387H7.46Z"
        clip-rule="evenodd"
      />
      <path
        class=${css(buildIconColorRule(shapeColor, ruleNames.stroke))}
        stroke-linecap="round"
        d="M14.033 3.953h2.007M9.522 3.953h2.007M18.544 3.953h2.007M14.033 8.464h2.007M9.522 8.464h2.007M18.544 8.464h2.007M14.033 12.975h2.007M9.522 12.975h2.007M18.544 12.975h2.007M14.033 17.485h2.007M18.544 17.485h2.007"
      />
    </svg>
  `;
}
