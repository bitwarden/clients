import { css } from "@emotion/css";
import { html } from "lit";

import { IconProps } from "../common-types";
import { buildIconColorRule, resolveIconColor, ruleNames } from "../constants/styles";

export function Lock(props: IconProps) {
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
        d="M10 10a.75.75 0 0 0-.75-.75h-2.5a.75.75 0 0 0 0 1.5h2.5A.75.75 0 0 0 10 10"
      />
      <path
        class=${css(buildIconColorRule(shapeColor, ruleNames.fill))}
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M4 4a4 4 0 0 1 7.153-2.462.75.75 0 1 1-1.182.924A2.5 2.5 0 0 0 5.5 4v1H13a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h1zM3 6.5a.5.5 0 0 0-.5.5v6a.5.5 0 0 0 .5.5h10a.5.5 0 0 0 .5-.5V7a.5.5 0 0 0-.5-.5z"
      />
    </svg>
  `;
}
