import { css } from "@emotion/css";
import { html } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { buildIconColorRule, ruleNames, themes } from "../constants/styles";

export function ExclamationTriangle({
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
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 22" fill="none">
      <path
        class=${css(buildIconColorRule(shapeColor, ruleNames.fill))}
        d="M21.627 21.877H2.373a2.28 2.28 0 0 1-1.195-.326 2.394 2.394 0 0 1-.869-.908 2.433 2.433 0 0 1 .015-2.404L9.951 1.33c.211-.368.511-.672.87-.883a2.322 2.322 0 0 1 2.357 0c.36.211.66.515.871.882l9.627 16.911a2.442 2.442 0 0 1 .015 2.404 2.39 2.39 0 0 1-.87.908c-.362.217-.775.33-1.194.326ZM12 1.677a.844.844 0 0 0-.436.115.883.883 0 0 0-.322.326l-9.625 16.91a.846.846 0 0 0 0 .844.876.876 0 0 0 .322.334.84.84 0 0 0 .44.117h19.248a.837.837 0 0 0 .44-.117.882.882 0 0 0 .322-.334.846.846 0 0 0 0-.843L12.758 2.118a.89.89 0 0 0-.322-.326.837.837 0 0 0-.436-.114Zm0 13.309a.735.735 0 0 1-.53-.228.794.794 0 0 1-.22-.55V7.105a.79.79 0 0 1 .22-.55.735.735 0 0 1 1.06 0c.14.146.22.344.22.55v7.105a.79.79 0 0 1-.22.55.74.74 0 0 1-.53.227Zm0 3.84c.491 0 .89-.412.89-.92 0-.51-.399-.922-.89-.922s-.89.412-.89.921c0 .51.399.922.89.922Z"
      />
    </svg>
  `;
}
