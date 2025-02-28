import { css } from "@emotion/css";
import { html, TemplateResult } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { ActionButton } from "../../../content/components/buttons/action-button";
import { spacing, themes } from "../../../content/components/constants/styles";
import { Folder, User } from "../../../content/components/icons";
import { DropdownMenu } from "../dropdown-menu";

export function ButtonRow({
  theme,
  buttonAction,
  buttonText,
}: {
  theme: Theme;
  buttonAction: (e: Event) => void;
  buttonText: string;
}) {
  return html`
    <div class=${buttonRowStyles}>
      ${[
        ActionButton({
          buttonAction: buttonAction,
          buttonText,
          theme,
        }),
        DropdownContainer({
          children: [
            DropdownMenu({
              buttonText: "You",
              icon: User({ color: themes[theme].text.muted, theme }),
              theme,
            }),
            DropdownMenu({
              buttonText: "Folder",
              icon: Folder({ color: themes[theme].text.muted, theme }),
              disabled: true,
              theme,
            }),
          ],
        }),
      ]}
    </div>
  `;
}

function DropdownContainer({ children }: { children: TemplateResult[] }) {
  return html` <div class=${dropdownContainerStyles}>${children}</div> `;
}

const buttonRowStyles = css`
  gap: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  max-height: 52px;
  white-space: nowrap;

  > button {
    max-width: min-content;
    flex: 1 1 50%;
  }

  > div {
    flex: 1 1 min-content;
  }
`;

const dropdownContainerStyles = css`
  gap: 8px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  overflow: hidden;

  > div {
    min-width: calc(50% - ${spacing["1.5"]});
  }
`;
