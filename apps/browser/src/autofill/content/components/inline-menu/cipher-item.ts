import { css } from "@emotion/css";
import { html, nothing } from "lit";

import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums";

import { InlineMenuCipherData } from "../../../background/abstractions/overlay.background";
import { EventSecurity } from "../../../utils/event-security";
import { CipherIcon } from "../cipher/cipher-icon";
import { spacing, themes } from "../constants/styles";
import { ExternalLink } from "../icons";

import { CipherDetails } from "./cipher-details";
import { TotpCipherInfo } from "./totp-cipher-info";
import { TotpCountdown } from "./totp-countdown";

const CIPHER_ITEM_SELECTOR = "[data-cipher-item]";
const CIPHER_CONTENT_SELECTOR = "[data-cipher-content]";
const FILL_CIPHER_SELECTOR = "[data-fill-cipher]";

export type InlineMenuCipherItemProps = {
  cipher: InlineMenuCipherData;
  theme: Theme;
  viewButtonText: string;
  opensInANewWindowText: string;
  fillCredentialsForText: string;
  logInWithPasskeyAriaLabel: string;
  handleFillCipher: (e: Event) => void;
  handleViewCipher: (e: Event) => void;
  bordered?: boolean;
  usernameText?: string;
  cardNumberEndsWithText?: string;
  fillVerificationCodeText?: string;
  totpCodeAria?: string;
  showTotpUsername?: boolean;
  totpSecondsRemaining?: number;
  onTotpPeriodElapsed?: () => void;
};

export function InlineMenuCipherItem({
  cipher,
  theme = ThemeTypes.Light,
  viewButtonText,
  opensInANewWindowText,
  fillCredentialsForText,
  logInWithPasskeyAriaLabel,
  handleFillCipher,
  handleViewCipher,
  bordered = true,
  usernameText,
  cardNumberEndsWithText,
  fillVerificationCodeText,
  totpCodeAria,
  showTotpUsername = false,
  totpSecondsRemaining,
  onTotpPeriodElapsed,
}: InlineMenuCipherItemProps) {
  const isTotp = !!(cipher.login?.totpField && cipher.login?.totp);
  const period = cipher.login?.totpCodeTimeInterval ?? 30;
  const fillPrefix = cipher.login?.passkey ? logInWithPasskeyAriaLabel : fillCredentialsForText;
  const fillLabel = `${fillPrefix} ${cipher.name}`;
  const fillDescription = getFillAriaDescription(cipher, usernameText, cardNumberEndsWithText);
  const viewButtonAria = `${viewButtonText} ${cipher.name}, ${opensInANewWindowText}`;
  const uri = (cipher.icon.imageEnabled && cipher.icon.image) || undefined;

  const onFillCipher = (event: Event) => {
    if (EventSecurity.isEventTrusted(event)) {
      handleFillCipher(event);
    }
  };

  const onViewCipher = (event: Event) => {
    if (EventSecurity.isEventTrusted(event)) {
      event.stopPropagation();
      handleViewCipher(event);
    }
  };

  return html`
    <div data-cipher-item class=${cipherItemStyles({ bordered, theme })}>
      <div data-cipher-content class=${cipherItemContentStyles(theme)}>
        <button
          type="button"
          data-fill-cipher
          class=${fillCipherButtonStyles}
          title=${fillLabel}
          aria-label=${fillLabel}
          aria-description=${fillDescription ?? nothing}
          @click=${onFillCipher}
          @keyup=${handleFillCipherKeyUp}
        >
          ${
            isTotp
              ? TotpCountdown({
                  theme,
                  period,
                  secondsRemaining: totpSecondsRemaining,
                  onPeriodElapsed: onTotpPeriodElapsed,
                })
              : CipherIcon({
                  color: themes[theme].primary["600"],
                  size: `calc(${spacing["4"]} + ${spacing["2"]})`,
                  theme,
                  uri,
                })
          }
          ${
            isTotp
              ? TotpCipherInfo({
                  theme,
                  heading: fillVerificationCodeText ?? "",
                  totp: cipher.login!.totp!,
                  totpCodeAria,
                  username: showTotpUsername ? cipher.login?.username : undefined,
                  masked: !!cipher.reprompt,
                })
              : CipherDetails({ theme, cipher })
          }
        </button>
        <button
          type="button"
          data-view-cipher
          title=${viewButtonText}
          aria-label=${viewButtonAria}
          class=${viewCipherButtonStyles(theme)}
          @click=${onViewCipher}
          @keyup=${handleViewCipherKeyUp}
        >
          ${ExternalLink({ theme, color: themes[theme].primary["600"] })}
        </button>
      </div>
    </div>
  `;
}

function handleFillCipherKeyUp(event: KeyboardEvent) {
  const listItem = getTrustedCipherKeyTarget(event, ["ArrowDown", "ArrowUp", "ArrowRight"]);
  if (!listItem) {
    return;
  }

  if (event.code === "ArrowRight") {
    focusViewCipherButton(listItem, event.target as HTMLElement);
    return;
  }

  focusFillCipher(listItem, event.code === "ArrowDown" ? 1 : -1);
}

function handleViewCipherKeyUp(event: KeyboardEvent) {
  const listItem = getTrustedCipherKeyTarget(event, ["ArrowDown", "ArrowUp", "ArrowLeft"]);
  if (!listItem) {
    return;
  }

  listItem.querySelector(CIPHER_CONTENT_SELECTOR)?.classList.remove("remove-outline");

  if (event.code === "ArrowLeft") {
    ((event.target as HTMLElement).previousElementSibling as HTMLElement | null)?.focus();
    return;
  }

  focusFillCipher(listItem, event.code === "ArrowDown" ? 1 : -1);
}

function getTrustedCipherKeyTarget(event: KeyboardEvent, keys: string[]): HTMLElement | null {
  if (
    !EventSecurity.isEventTrusted(event) ||
    !keys.includes(event.code) ||
    !(event.target instanceof Element)
  ) {
    return null;
  }

  event.preventDefault();
  return event.target.closest(CIPHER_ITEM_SELECTOR);
}

function focusFillCipher(currentListItem: HTMLElement, direction: 1 | -1) {
  const adjacentFill = getAdjacentCipherItem(currentListItem, direction)?.querySelector(
    FILL_CIPHER_SELECTOR,
  ) as HTMLElement | null;
  if (adjacentFill) {
    adjacentFill.focus();
    return;
  }

  const fills = currentListItem.parentElement?.querySelectorAll(FILL_CIPHER_SELECTOR);
  const fallback = direction === 1 ? fills?.[0] : fills?.[fills.length - 1];
  (fallback as HTMLElement | undefined)?.focus();
}

function getAdjacentCipherItem(
  currentListItem: HTMLElement,
  direction: 1 | -1,
): HTMLElement | null {
  let sibling =
    direction === 1 ? currentListItem.nextElementSibling : currentListItem.previousElementSibling;

  while (sibling) {
    if (sibling.matches(CIPHER_ITEM_SELECTOR)) {
      return sibling as HTMLElement;
    }
    sibling = direction === 1 ? sibling.nextElementSibling : sibling.previousElementSibling;
  }

  return null;
}

function focusViewCipherButton(currentListItem: HTMLElement, currentButtonElement: HTMLElement) {
  currentListItem.querySelector(CIPHER_CONTENT_SELECTOR)?.classList.add("remove-outline");
  (currentButtonElement.nextElementSibling as HTMLElement | null)?.focus();
}

function getFillAriaDescription(
  cipher: InlineMenuCipherData,
  usernameText?: string,
  cardNumberEndsWithText?: string,
): string | undefined {
  if (cipher.login) {
    const username = cipher.login.username || cipher.login.passkey?.userName || "";
    return username && usernameText ? `${usernameText.toLowerCase()}: ${username}` : undefined;
  }

  if (!cipher.card || !cardNumberEndsWithText) {
    return undefined;
  }

  const cardParts = cipher.card.split(", *");
  if (cardParts.length === 1) {
    const cardDigits = cardParts[0].startsWith("*") ? cardParts[0].substring(1) : cardParts[0];
    return `${cardNumberEndsWithText} ${cardDigits}`;
  }

  return `${cardParts[0]}, ${cardNumberEndsWithText} ${cardParts[1]}`;
}

const cipherItemStyles = ({ bordered, theme }: { bordered: boolean; theme: Theme }) => css`
  box-sizing: border-box;
  width: 100%;
  padding: calc(${spacing["1"]} / 2);
  list-style: none;
  transition: background-color 0.2s ease-in-out;
  ${bordered ? `border-bottom: 1px solid ${themes[theme].secondary["300"]};` : ""}

  :hover {
    background-color: ${themes[theme].background.alt};
  }
`;

const cipherItemContentStyles = (theme: Theme) => css`
  box-sizing: border-box;
  display: flex;
  align-items: center;
  width: 100%;
  padding: ${spacing["2"]} ${spacing["1"]} ${spacing["2"]} ${spacing["2"]};
  border-radius: ${spacing["1"]};

  :has(:focus-visible):not(.remove-outline) {
    outline: 2px solid ${themes[theme].primary["600"]};
    outline-offset: 1px;
  }
`;

const fillCipherButtonStyles = css`
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: ${spacing["2"]};
  width: calc(100% - (${spacing["4"]} * 2 + ${spacing["2"]}));
  margin: 0;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
  outline: none;
  line-height: 0;
  overflow: hidden;

  > div {
    min-width: 0;
    line-height: normal;
  }
`;

const viewCipherButtonStyles = (theme: Theme) => css`
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

  :focus {
    outline: 2px solid ${themes[theme].primary["600"]};
    outline-offset: 1px;
  }

  > svg {
    width: ${spacing["4"]};
    height: ${spacing["4"]};
  }
`;
