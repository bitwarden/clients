import { css } from "@emotion/css";
import { html } from "lit";

import { IconProps } from "../common-types";
import { buildIconColorRule, resolveIconColor, ruleNames } from "../constants/styles";

export function Key(props: IconProps) {
  const { ariaHidden = true } = props;
  const shapeColor = resolveIconColor(props);
  const fillClass = css(buildIconColorRule(shapeColor, ruleNames.fill));

  return html`
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="${ariaHidden}"
    >
      <path class=${fillClass} d="M15.75 9.5a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Z" />
      <path
        class=${fillClass}
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M14.5 17a7.473 7.473 0 0 1-3.055-.648L10.75 17v1.5a1 1 0 0 1-1 1h-1.5V21a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-3.586a1 1 0 0 1 .293-.707L7.32 11.68A7.5 7.5 0 1 1 14.5 17Zm-5.482-4.896-.261-.86a6 6 0 1 1 3.3 3.738l-.909-.406-1.898 1.772V18h-2.5v2.5H3.5v-2.879l5.518-5.517Z"
      />
    </svg>
  `;
}
