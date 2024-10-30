import { css } from "@emotion/css";
import { html, TemplateResult } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { ActionButton } from "./action-button";
import { BadgeButton } from "./badge-button";

export function ButtonRow({ theme }: { theme: Theme }) {
  return html`
    <div class=${buttonRowStyles}>
      ${[
        ActionButton({
          buttonAction: () => {
            window.alert("action button preseed!");
          },
          buttonText: "Action Button",
          theme,
        }),
        BadgeContainer({
          children: [
            BadgeButton({
              buttonAction: () => {
                window.alert("button 1 preseed!");
              },
              buttonText: "Badge Button 1",
              theme,
            }),
            BadgeButton({
              buttonAction: () => {
                window.alert("button 2 preseed!");
              },
              buttonText: "Badge Button 2",
              disabled: true,
              theme,
            }),
          ],
        }),
      ]}
    </div>
  `;
}

function BadgeContainer({ children }: { children: TemplateResult[] }) {
  return html` <div class=${badgeContainerStyles}>${children}</div> `;
}

const buttonRowStyles = css`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
`;

const badgeContainerStyles = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`;
