import { css } from "@emotion/css";
import { html } from "lit";

import { IconProps } from "../common-types";
import { buildIconColorRule, ruleNames, themes } from "../constants/styles";

export function Folder({ color, disabled, theme }: IconProps) {
  const shapeColor = disabled ? themes[theme].secondary["300"] : color || themes[theme].text.main;

  return html`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 14" fill="none">
      <path
        class=${css(buildIconColorRule(shapeColor, ruleNames.fill))}
        d="M12.705 2.813h-4.65a.48.48 0 0 1-.34-.155.509.509 0 0 1-.134-.355v-.231a1.354 1.354 0 0 0-.378-.947 1.291 1.291 0 0 0-.92-.397H1.296a1.291 1.291 0 0 0-.919.398A1.354 1.354 0 0 0 0 2.072v9.847c-.002.354.134.694.377.947.244.252.574.394.92.397l11.406.01a1.255 1.255 0 0 0 .907-.384 1.35 1.35 0 0 0 .39-.963V4.158c0-.353-.136-.693-.378-.945a1.296 1.296 0 0 0-.917-.4ZM1.297 1.562h4.988c.13.004.251.06.34.155a.504.504 0 0 1 .134.355v.231c0 .354.136.694.38.946.242.251.573.394.919.398h4.649c.128.004.25.059.34.154.089.096.137.223.134.355v.995a.326.326 0 0 1-.196.296.308.308 0 0 1-.12.024H1.139a.31.31 0 0 1-.223-.093.326.326 0 0 1-.092-.227V2.07a.506.506 0 0 1 .133-.355.479.479 0 0 1 .34-.155Zm11.734 10.735a.456.456 0 0 1-.325.139l-11.409-.008a.48.48 0 0 1-.34-.154.504.504 0 0 1-.133-.355V6.63a.33.33 0 0 1 .092-.227.32.32 0 0 1 .222-.094h11.727a.31.31 0 0 1 .223.094c.06.06.093.142.093.227v5.299a.527.527 0 0 1-.15.367Z"
      />
    </svg>
  `;
}
