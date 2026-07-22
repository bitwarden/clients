import { css } from "@emotion/css";
import { html } from "lit";

import { IconProps } from "../common-types";
import { buildIconColorRule, resolveIconColor, ruleNames } from "../constants/styles";

export function Plus(props: IconProps) {
  const { ariaHidden = true } = props;
  const shapeColor = resolveIconColor(props);

  return html`
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="${ariaHidden}"
    >
      <path
        class=${css(buildIconColorRule(shapeColor, ruleNames.fill))}
        d="M8 1.006a.75.75 0 0 1 .75.75V7.25h5.517a.75.75 0 0 1 0 1.5H8.75v5.537a.75.75 0 0 1-1.5 0V8.75H1.746a.75.75 0 1 1 0-1.5H7.25V1.756a.75.75 0 0 1 .75-.75"
      />
    </svg>
  `;
}
