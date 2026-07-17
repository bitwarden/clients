import { css } from "@emotion/css";
import { html, nothing } from "lit";

import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums";

import { InlineMenuCipherData } from "../../../background/abstractions/overlay.background";
import { EventSecurity } from "../../../utils/event-security";
import { CipherIcon } from "../cipher/cipher-icon";
import { spacing, themes, typography } from "../constants/styles";
import { ExternalLink, Passkey } from "../icons";

const TOTP_CIRCUMFERENCE = 78.5;
const TOTP_EXPIRY_SECONDS = 7;

export type InlineMenuCipherItemProps = {
  cipher: InlineMenuCipherData;
  theme: Theme;
  viewButtonText: string;
  handleFillCipher: (e: Event) => void;
  handleViewCipher: (e: Event) => void;
  bordered?: boolean;
  fillVerificationCodeText?: string;
  showTotpUsername?: boolean;
  totpSecondsRemaining?: number;
};

export function InlineMenuCipherItem({
  cipher,
  theme = ThemeTypes.Light,
  viewButtonText,
  handleFillCipher,
  handleViewCipher,
  bordered = true,
  fillVerificationCodeText = "Fill verification code",
  showTotpUsername = false,
  totpSecondsRemaining,
}: InlineMenuCipherItemProps) {
  const isTotp = !!(cipher.login?.totpField && cipher.login?.totp);
  const period = cipher.login?.totpCodeTimeInterval ?? 30;
  const secondsRemaining =
    totpSecondsRemaining ?? period - (Math.round(Date.now() / 1000) % period);
  const fillLabel = isTotp ? fillVerificationCodeText : cipher.name;
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
    <div class=${cipherItemStyles({ bordered, theme })}>
      <div class=${cipherItemContentStyles(theme)}>
        <button
          type="button"
          class=${fillCipherButtonStyles}
          title=${fillLabel}
          aria-label=${fillLabel}
          @click=${onFillCipher}
        >
          ${isTotp
            ? TotpCountdown({ theme, period, secondsRemaining })
            : CipherIcon({
                color: themes[theme].primary["600"],
                size: `calc(${spacing["4"]} + ${spacing["2"]})`,
                theme,
                uri,
              })}
          ${isTotp
            ? TotpCipherInfo({
                theme,
                heading: fillVerificationCodeText,
                totp: cipher.login!.totp!,
                username: showTotpUsername ? cipher.login?.username : undefined,
                masked: !!cipher.reprompt,
              })
            : CipherDetails({ theme, cipher })}
        </button>
        <button
          type="button"
          title=${viewButtonText}
          aria-label=${viewButtonText}
          class=${viewCipherButtonStyles(theme)}
          @click=${onViewCipher}
        >
          ${ExternalLink({ theme, color: themes[theme].primary["600"] })}
        </button>
      </div>
    </div>
  `;
}

function CipherDetails({ cipher, theme }: { cipher: InlineMenuCipherData; theme: Theme }) {
  const passkey = cipher.login?.passkey;

  if (passkey) {
    const showRpName = cipher.name !== passkey.rpName;
    const secondary = cipher.login?.username || passkey.userName;
    const firstLine = showRpName ? passkey.rpName : secondary;
    const secondLine = showRpName ? secondary : undefined;

    return html`
      <div>
        <span title=${cipher.name} class=${primaryTextStyles(theme)}>${cipher.name}</span>
        ${firstLine
          ? html`<span title=${firstLine} class=${passkeySubtitleStyles(theme)}>
              ${Passkey({
                theme,
                color: themes[theme].text.muted,
              })}
              ${firstLine}
            </span>`
          : nothing}
        ${secondLine
          ? html`<span title=${secondLine} class=${passkeySubtitleStyles(theme)}
              >${secondLine}</span
            >`
          : nothing}
      </div>
    `;
  }

  const subtitle =
    cipher.identity?.username ||
    cipher.identity?.fullName ||
    cipher.login?.username ||
    cipher.card ||
    "";

  return html`
    <div>
      <span title=${cipher.name} class=${primaryTextStyles(theme)}>${cipher.name}</span>
      ${subtitle
        ? html`<span title=${subtitle} class=${secondaryTextStyles(theme)}>${subtitle}</span>`
        : nothing}
    </div>
  `;
}

function TotpCountdown({
  theme,
  period,
  secondsRemaining,
}: {
  theme: Theme;
  period: number;
  secondsRemaining: number;
}) {
  const expiring = secondsRemaining <= TOTP_EXPIRY_SECONDS;
  const strokeColor = expiring ? themes[theme].passwordSpecial : themes[theme].primary["600"];
  const textColor = expiring ? themes[theme].passwordSpecial : themes[theme].text.main;

  return html`
    <span class=${totpCountdownStyles} aria-hidden="true">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 29 29">
        <circle
          fill="none"
          cx="14.5"
          cy="14.5"
          r="12.5"
          stroke-width="3"
          stroke-dasharray=${TOTP_CIRCUMFERENCE}
          stroke-dashoffset=${((period - secondsRemaining) / period) * TOTP_CIRCUMFERENCE}
          transform="rotate(-90 14.5 14.5)"
          stroke=${strokeColor}
        ></circle>
        <circle
          fill="none"
          cx="14.5"
          cy="14.5"
          r="14"
          stroke-width="1"
          stroke=${strokeColor}
        ></circle>
      </svg>
      <span class=${totpSecondsStyles(textColor)}>${secondsRemaining}</span>
    </span>
  `;
}

function TotpCipherInfo({
  theme,
  heading,
  totp,
  username,
  masked,
}: {
  theme: Theme;
  heading: string;
  totp: string;
  username?: string;
  masked: boolean;
}) {
  const code = masked ? "●●●●●●" : `${totp.substring(0, 3)} ${totp.substring(3)}`;

  return html`
    <div>
      <span title=${heading} class=${primaryTextStyles(theme)}>${heading}</span>
      ${username
        ? html`<span title=${username} class=${secondaryTextStyles(theme)}>${username}</span>`
        : nothing}
      <span class=${totpCodeStyles(theme, masked)} data-testid="totp-code" title=${code}
        >${code}</span
      >
    </div>
  `;
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

  :has(:focus-visible) {
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

const primaryTextStyles = (theme: Theme) => css`
  ${typography.body2}

  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: ${themes[theme].text.main};
  font-weight: 500;
`;

const secondaryTextStyles = (theme: Theme) => css`
  ${typography.helperMedium}

  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: ${themes[theme].text.muted};
`;

const passkeySubtitleStyles = (theme: Theme) => css`
  ${typography.helperMedium}

  display: flex;
  align-items: center;
  gap: ${spacing["1"]};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: ${themes[theme].text.muted};

  > svg {
    flex-shrink: 0;
    width: ${spacing["3"]};
    height: ${spacing["3"]};
  }
`;

const totpCountdownStyles = css`
  position: relative;
  display: inline-flex;
  width: calc(${spacing["4"]} * 2);
  height: calc(${spacing["4"]} * 2);

  > svg {
    width: 100%;
    height: 100%;
  }
`;

const totpSecondsStyles = (color: string) => css`
  ${typography.helperMedium}

  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: ${color};
`;

const totpCodeStyles = (theme: Theme, masked: boolean) => css`
  ${typography.helperMedium}

  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: ${themes[theme].text.muted};
  ${masked ? "letter-spacing: 0.2rem;" : ""}
`;
