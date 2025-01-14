import { css } from "@emotion/css";
import { html } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { themes } from "../../../content/components/constants/styles";
import { Business, Family } from "../../../content/components/icons";

// @TODO connect data source to icon checks
// @TODO support other indicator types (attachments, etc)
export function CipherInfoIndicatorIcons({
  isBusinessOrg,
  isFamilyOrg,
  theme,
}: {
  isBusinessOrg?: boolean;
  isFamilyOrg?: boolean;
  theme: Theme;
}) {
  const indicatorIcons = [
    ...(isBusinessOrg ? [Business({ color: themes[theme].text.muted, theme })] : []),
    ...(isFamilyOrg ? [Family({ color: themes[theme].text.muted, theme })] : []),
  ];

  return indicatorIcons.length
    ? html` <span class=${cipherInfoIndicatorIconsStyles}> ${indicatorIcons} </span> `
    : null; // @TODO null case should be handled by parent
}

const cipherInfoIndicatorIconsStyles = css`
  > svg {
    width: fit-content;
    height: 12px;
  }
`;
