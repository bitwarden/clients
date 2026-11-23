import { css } from "@emotion/css";
import { html, nothing, TemplateResult } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { EventSecurity } from "../../../utils/event-security";
import { spacing, themes, typography } from "../constants/styles";
import { CheckCircle, Clone, Key, Refresh } from "../icons";

import { ColorizedPassword, ColorizedPasswordI18n } from "./colorized-password";
import { InlineMenuContainer } from "./container";

const ACTIONS_SELECTOR = "[data-password-generator-actions]";
const REFRESH_SELECTOR = "[data-refresh-generated-password]";
const COPY_SELECTOR = "[data-copy-generated-password]";
const ICON_SELECTOR = "[data-password-generator-icon]";
const CONFIRMED_SELECTOR = "[data-password-generator-confirmed]";
const CONFIRMED_ICON_MS = 2000;
const revertTimers = new WeakMap<Element, number>();

export type InlineMenuPasswordGeneratorI18n = ColorizedPasswordI18n & {
  regeneratePassword: string;
  copyPassword: string;
};

export type InlineMenuPasswordGeneratorProps = {
  password: string;
  headingText: string;
  theme: Theme;
  i18n: InlineMenuPasswordGeneratorI18n;
  handleFillPassword: (e: Event) => void;
  handleRefreshPassword: (e: Event) => void;
  handleCopyPassword: (e: Event) => void;
  /** Design-system layout: clone beside generate. A click confirms that icon only. */
  designSystem?: boolean;
};

export function InlineMenuPasswordGenerator({
  password,
  headingText,
  theme,
  i18n,
  handleFillPassword,
  handleRefreshPassword,
  handleCopyPassword,
  designSystem = false,
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
      if (designSystem) {
        showIconConfirmed(event.target.closest(REFRESH_SELECTOR));
      }
      handleRefreshPassword(event);
    }
  };

  const onCopy = (event: Event) => {
    if (EventSecurity.isEventTrusted(event) && event.target instanceof Element) {
      handleCopyPassword(event);
      showIconConfirmed(event.target.closest(COPY_SELECTOR));
    }
  };

  const iconColor = designSystem
    ? themes[theme].designSystem.iconStrong
    : themes[theme].primary["600"];

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
            class=${designSystem ? designFillButtonStyles : fillButtonStyles}
            aria-label=${headingText}
            @click=${onFill}
            @keyup=${(event: KeyboardEvent) => handleActionKeyUp(event, "ArrowRight")}
          >
            ${
              designSystem
                ? nothing
                : html`<span class=${keyIconStyles}>
                    ${Key({ theme, color: themes[theme].primary["600"] })}
                  </span>`
            }
            <div class=${contentStyles}>
              <div class=${headingStyles(theme)}>${headingText}</div>
              ${ColorizedPassword({ password, theme, i18n })}
            </div>
          </button>
          ${
            designSystem
              ? html`
                  <button
                    type="button"
                    data-copy-generated-password
                    tabindex="-1"
                    class=${cloneButtonStyles}
                    aria-label=${i18n.copyPassword}
                    @click=${onCopy}
                    @keyup=${handleActionKeyUp}
                  >
                    ${confirmableIcon(Clone({ theme, color: iconColor }), cloneIconStyles, theme, iconColor)}
                  </button>
                `
              : nothing
          }
          <button
            type="button"
            data-refresh-generated-password
            tabindex="-1"
            class=${designSystem ? designRefreshButtonStyles : refreshButtonStyles(theme)}
            aria-label=${i18n.regeneratePassword}
            @click=${onRefresh}
            @keyup=${handleActionKeyUp}
          >
            ${
              designSystem
                ? confirmableIcon(
                    Refresh({ theme, color: iconColor }),
                    generateIconStyles,
                    theme,
                    iconColor,
                  )
                : Refresh({ theme, color: iconColor })
            }
          </button>
        </div>
      </div>
    `,
  });
}

function showIconConfirmed(button: Element | null) {
  if (!button) {
    return;
  }

  const icon = button.querySelector<HTMLElement>(ICON_SELECTOR);
  const confirmed = button.querySelector<HTMLElement>(CONFIRMED_SELECTOR);
  if (icon) {
    icon.hidden = true;
  }
  if (confirmed) {
    confirmed.hidden = false;
  }

  const pending = revertTimers.get(button);
  if (pending !== undefined) {
    window.clearTimeout(pending);
  }
  revertTimers.set(
    button,
    window.setTimeout(() => {
      revertTimers.delete(button);
      if (icon) {
        icon.hidden = false;
      }
      if (confirmed) {
        confirmed.hidden = true;
      }
    }, CONFIRMED_ICON_MS),
  );
}

/** An action icon paired with a hidden check mark that `showIconConfirmed` swaps in. */
function confirmableIcon(icon: TemplateResult, iconClass: string, theme: Theme, color: string) {
  return html`
    <span data-password-generator-icon class=${iconClass}>${icon}</span>
    <span data-password-generator-confirmed hidden class=${confirmedIconStyles}
      >${CheckCircle({ theme, color })}</span
    >
  `;
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

function handleActionKeyUp(event: KeyboardEvent, arrowCode?: "ArrowLeft" | "ArrowRight") {
  const direction =
    arrowCode ??
    (event.code === "ArrowLeft" || event.code === "ArrowRight" ? event.code : undefined);
  if (!direction || !isTrustedActionKey(event, direction)) {
    return;
  }

  const actions = event.target.closest(ACTIONS_SELECTOR);
  const button = event.target.closest("button");
  if (!actions || !button) {
    return;
  }

  const buttons = [...actions.querySelectorAll<HTMLElement>("button")];
  const next = buttons[buttons.indexOf(button) + (direction === "ArrowRight" ? 1 : -1)];
  if (!next) {
    return;
  }

  next.focus();
  actions.classList.toggle("remove-outline", direction === "ArrowRight");
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

const designFillButtonStyles = css`
  box-sizing: border-box;
  display: flex;
  flex: 1;
  align-items: center;
  gap: ${spacing["2"]};
  width: auto;
  min-width: 0;
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

const designRefreshButtonStyles = css`
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  margin: 0 0 0 ${spacing["2"]};
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  line-height: 0;
`;

const generateIconStyles = css`
  display: inline-flex;
  width: 18px;
  height: 18px;

  &[hidden] {
    display: none !important;
  }

  > svg {
    width: 18px;
    height: 18px;
  }
`;

const cloneButtonStyles = css`
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  line-height: 0;
`;

const cloneIconStyles = css`
  display: inline-flex;
  width: 14.167px;
  height: 16.667px;
  aspect-ratio: 17 / 20;

  &[hidden] {
    display: none !important;
  }

  > svg {
    width: 14.167px;
    height: 16.667px;
  }
`;

const confirmedIconStyles = css`
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;

  &[hidden] {
    display: none;
  }

  > svg {
    width: 20px;
    height: 20px;
  }
`;
