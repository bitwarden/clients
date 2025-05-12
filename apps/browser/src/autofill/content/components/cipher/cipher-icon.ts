import { css } from "@emotion/css";
import { html } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { Globe } from "../../../content/components/icons";

export type CipherIconProps = {
  color: string;
  size: string;
  theme: Theme;
  uri?: string;
};

/**
 * @param {string} props.color contextual color override if no icon URI is available
 * @param {string} props.size valid CSS `width` value, represents the width-basis of the graphic, with height maintaining original aspect-ratio
 */
export function CipherIcon({ color, size, theme, uri }: CipherIconProps) {
  const iconClass = cipherIconStyle({ width: size });

  return uri
    ? html`<img class=${iconClass} src=${uri} />`
    : html`<span class=${iconClass}>${Globe({ color, theme })}</span>`;
}

const cipherIconStyle = ({ width }: { width: string }) => css`
  width: ${width};
  height: fit-content;
`;
