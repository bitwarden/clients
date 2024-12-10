import { css } from "@emotion/css";
import { html } from "lit";

import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums";

import { spacing } from "../../constants/styles";
import { CipherData } from "../../types";

import { CipherAction } from "./cipher-action";
import { CipherIcon } from "./cipher-icon";
import { CipherInfo } from "./cipher-info";

export function CipherItem({
  cipher,
  handleAction,
  notificationType,
  theme = ThemeTypes.Light,
}: {
  cipher: CipherData;
  handleAction?: (e: Event) => void;
  notificationType: string;
  theme: Theme;
}) {
  const { icon } = cipher;
  const cipherAction = CipherAction({ handleAction, notificationType, theme });

  return [
    html`
      <div class=${cipherItemStyles}>
        ${CipherIcon({ theme, ...icon })} ${CipherInfo({ theme, cipher })}
      </div>
      ${cipherAction ? html`<div>${cipherAction}</div>` : null}
    `,
  ];
}

const cipherIconWidth = "24px";

const cipherItemStyles = css`
  gap: ${spacing["2"]};
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: start;

  > div {
    max-width: calc(100% - ${cipherIconWidth} - ${spacing["2"]});
  }
`;
