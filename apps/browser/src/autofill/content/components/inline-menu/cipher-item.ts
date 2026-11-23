import { css } from "@emotion/css";
import { html, nothing } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { InlineMenuCipherData } from "../../../background/abstractions/overlay.background";
import { EventSecurity } from "../../../utils/event-security";
import { CipherIcon } from "../cipher/cipher-icon";
import { spacing, themes } from "../constants/styles";
import { BwiIcon, ExternalLink } from "../icons";

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
  passkeyText?: string;
  totpCodeAria?: string;
  showTotpUsername?: boolean;
  totpSecondsRemaining?: number;
  onTotpPeriodElapsed?: () => void;
  onListEdgeReached?: (direction: 1 | -1) => void;
  /** When set, a missing favicon uses the cipher's bwi icon instead of the globe. */
  useCipherTypeIcon?: boolean;
};

export function InlineMenuCipherItem({
  cipher,
  theme,
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
  passkeyText,
  totpCodeAria,
  showTotpUsername = false,
  totpSecondsRemaining,
  onTotpPeriodElapsed,
  onListEdgeReached,
  useCipherTypeIcon = false,
}: InlineMenuCipherItemProps) {
  const isTotp = !!(cipher.login?.totpField && cipher.login?.totp);
  const listedUsername = showTotpUsername ? cipher.login?.username : undefined;
  const usernameIsHeading = useCipherTypeIcon && listedUsername;
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

  const onFillKeyUp = (event: KeyboardEvent) => handleFillCipherKeyUp(event, onListEdgeReached);
  const onViewKeyUp = (event: KeyboardEvent) => handleViewCipherKeyUp(event, onListEdgeReached);
  const showIconTile = useCipherTypeIcon && (isTotp || !uri);
  const tokens = themes[theme].designSystem;
  const iconColor = showIconTile ? tokens.tileForeground : themes[theme].primary["600"];
  const glyph = isTotp
    ? TotpCountdown({
        theme,
        period,
        secondsRemaining: totpSecondsRemaining,
        onPeriodElapsed: onTotpPeriodElapsed,
        color: showIconTile ? tokens.iconMuted : undefined,
        outerProgressRing: useCipherTypeIcon,
      })
    : CipherIcon({
        color: iconColor,
        size: showIconTile ? spacing["4"] : `calc(${spacing["4"]} + ${spacing["2"]})`,
        theme,
        uri,
        icon: useCipherTypeIcon ? cipher.icon.icon : undefined,
        designSystem: useCipherTypeIcon,
      });

  return html`
    <div
      data-cipher-item
      role="listitem"
      class=${cipherItemStyles({ bordered, theme, designSystem: useCipherTypeIcon })}
    >
      <div data-cipher-content class=${cipherItemContentStyles(theme, useCipherTypeIcon)}>
        <button
          type="button"
          data-fill-cipher
          tabindex="-1"
          class=${useCipherTypeIcon ? designFillCipherButtonStyles : fillCipherButtonStyles}
          title=${fillLabel}
          aria-label=${fillLabel}
          aria-description=${fillDescription ?? nothing}
          @click=${onFillCipher}
          @keyup=${onFillKeyUp}
        >
          ${
            useCipherTypeIcon
              ? html`<span class=${designStartSlotStyles}
                  >${showIconTile ? html`<span class=${iconTileStyles(theme)}>${glyph}</span>` : glyph}</span
                >`
              : glyph
          }
          ${
            isTotp
              ? TotpCipherInfo({
                  theme,
                  heading: usernameIsHeading || (fillVerificationCodeText ?? ""),
                  totp: cipher.login!.totp!,
                  totpCodeAria,
                  username: usernameIsHeading ? undefined : listedUsername,
                  masked: !!cipher.reprompt,
                })
              : CipherDetails({
                  theme,
                  cipher,
                  designSystem: useCipherTypeIcon,
                  passkeyText,
                })
          }
        </button>
        <button
          type="button"
          data-view-cipher
          tabindex="-1"
          title=${viewButtonText}
          aria-label=${viewButtonAria}
          class=${viewCipherButtonStyles(theme, useCipherTypeIcon)}
          @click=${onViewCipher}
          @keyup=${onViewKeyUp}
        >
          ${
            useCipherTypeIcon
              ? BwiIcon({
                  name: "bwi-external-link",
                  color: tokens.iconStrong,
                  size: "20px",
                })
              : ExternalLink({
                  theme,
                  color: themes[theme].primary["600"],
                })
          }
        </button>
      </div>
    </div>
  `;
}

function handleFillCipherKeyUp(
  event: KeyboardEvent,
  onListEdgeReached?: (direction: 1 | -1) => void,
) {
  const listItem = getTrustedCipherKeyTarget(event, ["ArrowDown", "ArrowUp", "ArrowRight"]);
  if (!listItem) {
    return;
  }

  if (event.code === "ArrowRight") {
    focusViewCipherButton(listItem, event.target as HTMLElement);
    return;
  }

  focusFillCipher(listItem, event.code === "ArrowDown" ? 1 : -1, onListEdgeReached);
}

function handleViewCipherKeyUp(
  event: KeyboardEvent,
  onListEdgeReached?: (direction: 1 | -1) => void,
) {
  const listItem = getTrustedCipherKeyTarget(event, ["ArrowDown", "ArrowUp", "ArrowLeft"]);
  if (!listItem) {
    return;
  }

  listItem.querySelector(CIPHER_CONTENT_SELECTOR)?.classList.remove("remove-outline");

  if (event.code === "ArrowLeft") {
    ((event.target as HTMLElement).previousElementSibling as HTMLElement | null)?.focus();
    return;
  }

  focusFillCipher(listItem, event.code === "ArrowDown" ? 1 : -1, onListEdgeReached);
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

function focusFillCipher(
  currentListItem: HTMLElement,
  direction: 1 | -1,
  onListEdgeReached?: (direction: 1 | -1) => void,
) {
  const adjacentFill = getAdjacentCipherItem(currentListItem, direction)?.querySelector(
    FILL_CIPHER_SELECTOR,
  ) as HTMLElement | null;
  if (adjacentFill) {
    adjacentFill.focus();
    return;
  }

  if (onListEdgeReached) {
    onListEdgeReached(direction);
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

const cipherItemStyles = ({
  bordered,
  theme,
  designSystem,
}: {
  bordered: boolean;
  theme: Theme;
  designSystem: boolean;
}) => css`
  box-sizing: border-box;
  width: 100%;
  list-style: none;
  ${
    designSystem
      ? `
    min-height: 36px;
    padding: 6px 8px;
    background-color: transparent;
    ${bordered ? `border-bottom: 1px solid var(--color-border-base, ${themes[theme].designSystem.border});` : ""}

    &:has([data-fill-cipher]:hover) {
      background-color: var(--color-bg-brand-softer, ${themes[theme].designSystem.hover});
    }

    &:has([data-fill-cipher]:focus-visible) {
      box-shadow: inset 0 0 0 2px var(--color-border-focus, ${themes[theme].designSystem.focus});
    }
  `
      : `
    padding: calc(${spacing["1"]} / 2);
    transition: background-color 0.2s ease-in-out;
    ${bordered ? `border-bottom: 1px solid ${themes[theme].secondary["300"]};` : ""}

    :hover {
      background-color: ${themes[theme].background.alt};
    }
  `
  }
`;

const cipherItemContentStyles = (theme: Theme, designSystem: boolean) => css`
  box-sizing: border-box;
  display: flex;
  align-items: center;
  width: 100%;
  ${
    designSystem
      ? `
    gap: 12px;
    padding: 0;
  `
      : `
    padding: ${spacing["2"]} ${spacing["1"]} ${spacing["2"]} ${spacing["2"]};
    border-radius: ${spacing["1"]};

    :has(:focus-visible):not(.remove-outline) {
      outline: 2px solid ${themes[theme].primary["600"]};
      outline-offset: 1px;
    }
  `
  }
`;

const designStartSlotStyles = css`
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: flex-start;
  width: 28px;
`;

const iconTileStyles = (theme: Theme) => css`
  box-sizing: border-box;
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: 1px solid var(--color-border-decorative-gray, ${themes[theme].designSystem.border});
  border-radius: 4px;
  background: var(--color-bg-decorative-gray, ${themes[theme].designSystem.tileBackground});

  &:has([data-totp-seconds]) {
    background: transparent;
    border: none;
  }

  > span {
    width: 16px;
    height: 16px;
    max-height: 16px;
  }

  > span:has([data-totp-seconds]) {
    width: 100%;
    height: 100%;
    max-height: none;
  }

  > span > svg {
    width: 100%;
    height: 100%;
  }
`;

const designFillCipherButtonStyles = css`
  box-sizing: border-box;
  display: flex;
  flex: 1;
  align-items: center;
  gap: 12px;
  min-width: 0;
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

const viewCipherButtonStyles = (theme: Theme, designSystem: boolean) => css`
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: ${designSystem ? "32px" : `calc(${spacing["4"]} * 2 + ${spacing["2"]})`};
  height: ${designSystem ? "32px" : `calc(${spacing["4"]} * 2 + ${spacing["2"]})`};
  margin: 0;
  padding: 0;
  border: none;
  border-radius: ${designSystem ? "12px" : spacing["1"]};
  background: transparent;
  cursor: pointer;
  line-height: 0;

  ${
    designSystem
      ? `
    :focus-visible {
      outline: none;
      box-shadow: inset 0 0 0 2px var(--color-border-focus, ${themes[theme].designSystem.focus});
    }
  `
      : `
    :focus {
      outline: 2px solid ${themes[theme].primary["600"]};
      outline-offset: 1px;
    }
  `
  }

  > svg {
    width: ${designSystem ? "20px" : spacing["4"]};
    height: ${designSystem ? "20px" : spacing["4"]};
    ${designSystem ? "flex-shrink: 0; aspect-ratio: 1 / 1;" : ""}
  }
`;
