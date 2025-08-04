import { css } from "@emotion/css";
import { html, TemplateResult } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { themes } from "../../../content/components/constants/styles";
import { Business, Family } from "../../../content/components/icons";

import { OrganizationCategories, OrganizationCategory } from "./types";

const cipherIndicatorIconsMap: Record<
  OrganizationCategory,
  (args: { color: string; theme: Theme }) => TemplateResult
> = {
  [OrganizationCategories.business]: Business,
  [OrganizationCategories.family]: Family,
};

export type CipherInfoIndicatorIconsProps = {
  organizationCategories?: OrganizationCategory[];
  theme: Theme;
};

export function CipherInfoIndicatorIcons({
  organizationCategories = [],
  theme,
}: CipherInfoIndicatorIconsProps) {
  return html`
    <span class=${cipherInfoIndicatorIconsStyles}>
      ${organizationCategories.map((name) =>
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
