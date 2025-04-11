import { css } from "@emotion/css";
import { html } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { themes } from "../../../content/components/constants/styles";
import { Business, Family } from "../../../content/components/icons";

// @TODO connect data source to icon checks
// @TODO support other indicator types (attachments, etc)
export function CipherInfoIndicatorIcons({
  showBusinessIcon,
  showFamilyIcon,
  theme,
}: {
  showBusinessIcon?: boolean;
  showFamilyIcon?: boolean;
  theme: Theme;
}) {
  const indicatorIcons = [
    ...(showBusinessIcon ? [Business({ color: themes[theme].text.muted, theme })] : []),
    ...(showFamilyIcon ? [Family({ color: themes[theme].text.muted, theme })] : []),
  ];

  return html` <span class=${cipherInfoIndicatorIconsStyles}> ${indicatorIcons} </span> `;
}

const cipherInfoIndicatorIconsStyles = css`
  > svg {
    width: fit-content;
    height: 12px;
  }
`;
