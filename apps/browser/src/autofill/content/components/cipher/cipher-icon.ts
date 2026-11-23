import { css } from "@emotion/css";
import { html } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { BwiIcon, Globe } from "../../../content/components/icons";

export type CipherIconProps = {
  color: string;
  size: string;
  theme: Theme;
  uri?: string;
  /** bwi icon name used when no favicon is available. Defaults to the globe. */
  icon?: string;
  /** Design-system glyphs. The default icons stay on the unflagged inline menu. */
  designSystem?: boolean;
};

/**
 * @param {string} props.color contextual color override if no icon URI is available
 * @param {string} props.size valid CSS `width` value, represents the width-basis of the graphic, with height maintaining original aspect-ratio
 */
export function CipherIcon({
  color,
  size,
  theme,
  uri,
  icon,
  designSystem = false,
}: CipherIconProps) {
  if (uri) {
    return html`<img
      class=${cipherIconStyle({ width: size, favicon: designSystem })}
      src=${uri}
      alt=""
    />`;
  }

  if (designSystem) {
    return BwiIcon({ name: icon ?? "", color, size });
  }

  return html`<span class=${cipherIconStyle({ width: size, favicon: false })}
    >${Globe({ color, theme })}</span
  >`;
}

const cipherIconStyle = ({ width, favicon }: { width: string; favicon: boolean }) => css`
  width: ${width};
  height: ${favicon ? width : "fit-content"};
  max-height: ${favicon ? width : "24px"}; /* fallback for Safari */
  ${favicon ? "flex-shrink: 0; border-radius: 6px; object-fit: contain;" : ""}
`;
