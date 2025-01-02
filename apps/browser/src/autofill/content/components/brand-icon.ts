import { css } from "@emotion/css";
import { html } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { BitwardenLogo } from "./icons";

export function BrandIcon({ iconLink, theme }: { iconLink?: URL; theme: Theme }) {
  const Icon = html`<div class=${iconStyles}>${BitwardenLogo({ theme })}</div>`;

  return iconLink ? html`<a href="${iconLink}" target="_blank" rel="noreferrer">${Icon}</a>` : Icon;
}

const iconStyles = css`
  > svg {
    width: 20px;
    height: fit-content;
  }
`;
