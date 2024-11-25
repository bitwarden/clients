import { css } from "@emotion/css";
import { html } from "lit";

import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums";

import { spacing } from "../../constants/styles";
import { CipherData } from "../../types";

import { CipherIcon, CipherInfo, CipherAction } from "./index";

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

  return [
    html`
      <div class=${cipherItemStyles}>
        ${CipherIcon({ theme, ...icon })} ${CipherInfo({ theme, cipher })}
      </div>
    `,
    CipherAction({ handleAction, notificationType, theme }),
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

  > img,
  > svg {
    width: ${cipherIconWidth};
    height: fit-content;
  }
`;
