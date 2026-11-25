import { css } from "@emotion/css";
import { html, nothing } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { spacing, themes, typography } from "../constants/styles";

import { InlineMenuAction, InlineMenuActionConfig, InlineMenuActionProps } from "./action";
import { InlineMenuContainer } from "./container";

export type InlineMenuPromptI18n = InlineMenuActionProps["i18n"];

export type InlineMenuPromptProps = Omit<InlineMenuActionProps, "borderedTop"> & {
  /** When omitted, renders action-only for scenarios like "Save to Bitwarden". */
  message?: string;
  dataTestId?: string;
  /** Rendered below the primary action with the same treatment. */
  secondaryAction?: InlineMenuActionConfig;
};

export function InlineMenuPrompt({
  message,
  dataTestId,
  secondaryAction,
  ...actionProps
}: InlineMenuPromptProps) {
  return InlineMenuContainer({
    theme: actionProps.theme,
    dataTestId,
    children: html`
      ${
        message
          ? html`<div class=${messageStyles(actionProps.theme)} title=${message}>${message}</div>`
          : nothing
      }
      ${InlineMenuAction({ ...actionProps, borderedTop: !!message })}
      ${
        secondaryAction
          ? InlineMenuAction({ ...secondaryAction, theme: actionProps.theme, borderedTop: true })
          : nothing
      }
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
