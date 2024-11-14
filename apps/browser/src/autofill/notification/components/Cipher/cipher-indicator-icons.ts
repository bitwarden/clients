import { css } from "@emotion/css";
import { html } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { themes } from "../../constants/styles";
import { CipherData } from "../../types";
import { Business } from "../icons";

// @TODO support other indicator types (attachments, family orgs, etc)
export function CipherInfoIndicatorIcons({ cipher, theme }: { cipher: CipherData; theme: Theme }) {
  // @TODO connect data source to icon checks
  const isBusinessOrg = false;

  const indicatorIcons = [
    ...(isBusinessOrg ? [Business({ color: themes[theme].text.muted, theme })] : []),
  ];

  return indicatorIcons.length
    ? html` <span class=${cipherInfoIndicatorIconsStyles}> ${indicatorIcons} </span> `
    : null; // @TODO null case should be handled by parent
}

const cipherInfoIndicatorIconsStyles = css`
  > svg {
    width: 12px;
    height: fit-content;
  }
`;
