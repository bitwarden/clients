import { css } from "@emotion/css";
import { html, TemplateResult } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { themes } from "../../../content/components/constants/styles";
import { Business, Family } from "../../../content/components/icons";

import { CipherIndicatorIconType, CipherIndicatorIconTypes } from "./types";

const cipherIndicatorIconsMap: Record<
  CipherIndicatorIconType,
  (args: { color: string; theme: Theme }) => TemplateResult
> = {
  [CipherIndicatorIconTypes.business]: Business,
  [CipherIndicatorIconTypes.families]: Family,
};

export function CipherInfoIndicatorIcons({
  cipherIndicatorIcons = [],
  theme,
}: {
  cipherIndicatorIcons?: CipherIndicatorIconType[];
  theme: Theme;
}) {
  return html`
    <span class=${cipherInfoIndicatorIconsStyles}>
      ${cipherIndicatorIcons.map((name) =>
        cipherIndicatorIconsMap[name]?.({ color: themes[theme].text.muted, theme }),
      )}
    </span>
  `;
}

const cipherInfoIndicatorIconsStyles = css`
  > svg {
    width: fit-content;
    height: 12px;
  }
`;
