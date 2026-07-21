import { css } from "@emotion/css";
import { html, nothing, TemplateResult } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { EventSecurity } from "../../../utils/event-security";
import { IconProps } from "../common-types";
import { spacing, themes, typography } from "../constants/styles";

import { InlineMenuContainer } from "./container";

export type InlineMenuPromptI18n = {
  actionAria: string;
};

export type InlineMenuPromptProps = {
  /** When omitted, renders action-only for scenarios like "Save to Bitwarden". */
  message?: string;
  actionText: string;
  i18n: InlineMenuPromptI18n;
  theme: Theme;
  handleAction: (e: Event) => void;
  icon?: (props: IconProps) => TemplateResult;
  dataTestId?: string;
  actionDataTestId?: string;
};

export function InlineMenuPrompt({
  message,
  actionText,
  i18n,
  theme,
  handleAction,
  icon,
  dataTestId,
  actionDataTestId,
}: InlineMenuPromptProps) {
  const handleButtonClick = (event: Event) => {
    if (EventSecurity.isEventTrusted(event)) {
      handleAction(event);
    }
  };

  return InlineMenuContainer({
    theme,
    dataTestId,
    children: html`
      ${
        message
          ? html`<div class=${messageStyles(theme)} title=${message}>${message}</div>`
          : nothing
      }
      <div class=${actionContainerStyles(theme, !!message)}>
        <button
          type="button"
          class=${actionButtonStyles(theme)}
          data-testid="${actionDataTestId}"
          aria-label=${i18n.actionAria}
          @click=${handleButtonClick}
        >
          ${
            icon
              ? html`
                  <span class=${actionIconStyles}>
                    ${icon({ theme, color: themes[theme].primary["600"] })}
                  </span>
                `
              : null
          }
          <span>${actionText}</span>
        </button>
      </div>
    `,
  });
}

const messageStyles = (theme: Theme) => css`
  ${typography.body1}

  box-sizing: border-box;
  width: 100%;
  padding: ${spacing["2"]};
  color: ${themes[theme].text.main};
`;

const actionContainerStyles = (theme: Theme, borderedTop: boolean) => css`
  box-sizing: border-box;
  width: 100%;
  padding: calc(${spacing["1"]} / 2);
  transition: background-color 0.2s ease-in-out;
  background-color: ${themes[theme].background.DEFAULT};
  ${
    borderedTop
      ? css`
          border-top: 1px solid ${themes[theme].secondary["300"]};
        `
      : css``
  }

  :hover {
    background-color: ${themes[theme].background.alt};
  }
`;

const actionButtonStyles = (theme: Theme) => css`
  ${typography.body1}

  user-select: none;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: ${spacing["2"]};
  width: 100%;
  margin: 0;
  padding: ${spacing["2"]};
  border: none;
  border-radius: ${spacing["1"]};
  background: transparent;
  cursor: pointer;
  text-align: left;
  font-weight: 500;
  color: ${themes[theme].primary["600"]};

  :focus-visible {
    outline: 2px solid ${themes[theme].primary["600"]};
    outline-offset: 1px;
  }
`;

const actionIconStyles = css`
  display: inline-flex;
  flex-shrink: 0;
  width: ${spacing["4"]};
  height: ${spacing["4"]};

  > svg,
  > span {
    width: ${spacing["4"]};
    height: ${spacing["4"]};
  }

  svg {
    width: ${spacing["4"]};
    height: ${spacing["4"]};
    vertical-align: middle;
  }
`;
