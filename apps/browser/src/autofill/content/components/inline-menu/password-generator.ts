import { css } from "@emotion/css";
import { html } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { EventSecurity } from "../../../utils/event-security";
import { spacing, themes, typography } from "../constants/styles";
import { Key, Refresh } from "../icons";

import { ColorizedPassword, ColorizedPasswordI18n } from "./colorized-password";
import { InlineMenuContainer } from "./container";

const ACTIONS_SELECTOR = "[data-password-generator-actions]";
const FILL_SELECTOR = "[data-fill-generated-password]";
const REFRESH_SELECTOR = "[data-refresh-generated-password]";

export type InlineMenuPasswordGeneratorI18n = ColorizedPasswordI18n & {
  regeneratePassword: string;
};

export type InlineMenuPasswordGeneratorProps = {
  password: string;
  headingText: string;
  theme: Theme;
  i18n: InlineMenuPasswordGeneratorI18n;
  handleFillPassword: (e: Event) => void;
  handleRefreshPassword: (e: Event) => void;
};

export function InlineMenuPasswordGenerator({
  password,
  headingText,
  theme,
  i18n,
  handleFillPassword,
  handleRefreshPassword,
}: InlineMenuPasswordGeneratorProps) {
  const onFill = (event: Event) => {
    if (EventSecurity.isEventTrusted(event)) {
      handleFillPassword(event);
    }
  };

  const onRefresh = (event: Event) => {
    if (EventSecurity.isEventTrusted(event) && event.target instanceof Element) {
      const actions = event.target.closest(ACTIONS_SELECTOR);
      actions?.classList.add("remove-outline");
      handleRefreshPassword(event);
    }
  };

  return InlineMenuContainer({
    theme,
    dataTestId: "inline-menu-password-generator",
    children: html`
      <div class=${containerStyles}>
        <div data-password-generator-actions class=${actionsStyles(theme)}>
          <button
            type="button"
            data-fill-generated-password
            tabindex="-1"
            class=${fillButtonStyles}
            aria-label=${headingText}
            @click=${onFill}
            @keyup=${(event: KeyboardEvent) => handleActionKeyUp(event, "ArrowRight")}
          >
            <span class=${keyIconStyles}>
              ${Key({ theme, color: themes[theme].primary["600"] })}
            </span>
            <div class=${contentStyles}>
              <div class=${headingStyles(theme)}>${headingText}</div>
              ${ColorizedPassword({ password, theme, i18n })}
            </div>
          </button>
          <button
            type="button"
            data-refresh-generated-password
            tabindex="-1"
            class=${refreshButtonStyles(theme)}
            aria-label=${i18n.regeneratePassword}
            @click=${onRefresh}
            @keyup=${(event: KeyboardEvent) => handleActionKeyUp(event, "ArrowLeft")}
          >
            ${Refresh({ theme, color: themes[theme].primary["600"] })}
          </button>
        </div>
      </div>
    `,
  });
}

function isTrustedActionKey(
  event: KeyboardEvent,
  arrowCode: "ArrowLeft" | "ArrowRight",
): event is KeyboardEvent & { target: HTMLElement } {
  return (
    EventSecurity.isEventTrusted(event) &&
    !event.ctrlKey &&
    !event.altKey &&
    !event.metaKey &&
    !event.shiftKey &&
    event.target instanceof HTMLElement &&
    event.code === arrowCode
  );
}

function handleActionKeyUp(event: KeyboardEvent, arrowCode: "ArrowLeft" | "ArrowRight") {
  if (!isTrustedActionKey(event, arrowCode)) {
    return;
  }

  const actions = event.target.closest(ACTIONS_SELECTOR);
  const target =
    actions?.querySelector<HTMLElement>(
      arrowCode === "ArrowRight" ? REFRESH_SELECTOR : FILL_SELECTOR,
    ) ?? null;
  target?.focus();
  actions?.classList.toggle("remove-outline", arrowCode === "ArrowRight");
}

const containerStyles = css`
  box-sizing: border-box;
  padding: calc(${spacing["1"]} / 2);
`;

const actionsStyles = (theme: Theme) => css`
  box-sizing: border-box;
  display: flex;
  align-items: center;
  width: 100%;
  padding: ${spacing["2"]} ${spacing["1"]} ${spacing["3"]} ${spacing["2"]};
  border-radius: ${spacing["1"]};
  transition: background-color 0.2s ease-in-out;

  :hover {
    background-color: ${themes[theme].background.alt};
  }

  :has(:focus-visible):not(.remove-outline) {
    outline: 2px solid ${themes[theme].primary["600"]};
    outline-offset: 1px;
  }
`;

const fillButtonStyles = css`
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: ${spacing["2"]};
  width: calc(100% - (${spacing["4"]} * 2 + ${spacing["2"]}));
  margin: 0;
  padding: 0 ${spacing["1"]} 0 0;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
  outline: none;
  overflow: hidden;
`;

const KEY_ICON_SIZE = `calc(${spacing["4"]} * 2)`;
const REFRESH_ICON_SIZE = `calc(${spacing["4"]} + ${spacing["2"]})`;

const keyIconStyles = css`
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: ${KEY_ICON_SIZE};
  height: ${KEY_ICON_SIZE};
  margin-top: calc(${spacing["1"]} / 2);

  > svg {
    width: ${KEY_ICON_SIZE};
    height: ${KEY_ICON_SIZE};
  }
`;

const contentStyles = css`
  text-align: left;
`;

const headingStyles = (theme: Theme) => css`
  ${typography.body2}

  margin-bottom: 1px;
  color: ${themes[theme].text.main};
  white-space: nowrap;
`;

const refreshButtonStyles = (theme: Theme) => css`
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: calc(${spacing["4"]} * 2 + ${spacing["2"]});
  height: calc(${spacing["4"]} * 2 + ${spacing["2"]});
  margin: 0;
  padding: 0;
  border: none;
  border-radius: ${spacing["1"]};
  background: transparent;
  cursor: pointer;
  line-height: 0;

  :focus-visible {
    outline: 2px solid ${themes[theme].primary["600"]};
    outline-offset: 1px;
  }

  > svg {
    width: ${REFRESH_ICON_SIZE};
    height: ${REFRESH_ICON_SIZE};
    margin-top: calc(${spacing["1"]} / 2);
  }
`;
