import { css } from "@emotion/css";
import { html } from "lit";

import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums";

import { spacing, themes, typography } from "../../../content/components/constants/styles";

export type ActionRowProps = {
  itemText: string;
  handleAction?: (e: Event) => void;
  theme: Theme;
};

export function ActionRow({ handleAction, itemText, theme = ThemeTypes.Light }: ActionRowProps) {
  return html`
    <button type="button" @click=${handleAction} class=${actionRowStyles(theme)} title=${itemText}>
      <span>${itemText}</span>
    </button>
  `;
}

const actionRowStyles = (theme: Theme) => css`
  ${typography.body2}

  user-select: none;
  border-width: 0 0 0.5px 0;
  border-style: solid;
  border-radius: ${spacing["2"]};
  border-color: ${themes[theme].secondary["300"]};
  background-color: ${themes[theme].background.DEFAULT};
  cursor: pointer;
  padding: ${spacing["2"]} ${spacing["3"]};
  width: 100%;
  min-height: 40px;
  text-align: left;
  color: ${themes[theme].primary["600"]};
  font-weight: 500;

  > span {
    display: block;
    width: calc(100% - 5px);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  :hover {
    background-color: ${themes[theme].primary["100"]};
    color: ${themes[theme].primary["600"]};
  }
`;
