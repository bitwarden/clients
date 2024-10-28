import { html, css } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { themes } from "../constants/styles";

export function NotificationHeaderMessage({ message, theme }: { message: string; theme: Theme }) {
  return html` <span style=${messageStyles(theme)}>${message}</span> `;
}

const messageStyles = (theme: Theme) => css`
  flex-grow: 1;
  overflow-x: hidden;
  text-align: left;
  text-overflow: ellipsis;
  line-height: 28px;
  white-space: nowrap;
  color: ${themes[theme].text.main};
  font-family: "DM Sans", sans-serif;
  font-size: 18px;
  font-weight: 600;
`;
