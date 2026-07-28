import { css } from "@emotion/css";
import { html } from "lit";
import { ref } from "lit/directives/ref.js";

import { Theme } from "@bitwarden/common/platform/enums";

import { spacing, themes, typography } from "../constants/styles";

const TOTP_CIRCUMFERENCE = 78.5;
const TOTP_EXPIRY_SECONDS = 7;

export type TotpCountdownProps = {
  theme: Theme;
  period: number;
  secondsRemaining?: number;
  onPeriodElapsed?: () => void;
};

export function TotpCountdown({
  theme,
  period,
  secondsRemaining,
  onPeriodElapsed,
}: TotpCountdownProps) {
  return html`
    <span
      class=${totpCountdownStyles}
      aria-hidden="true"
      ${ref(createTotpCountdownRef(theme, period, secondsRemaining, onPeriodElapsed))}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 29 29">
        <circle
          data-totp-inner
          fill="none"
          cx="14.5"
          cy="14.5"
          r="12.5"
          stroke-width="3"
          stroke-dasharray=${TOTP_CIRCUMFERENCE}
          transform="rotate(-90 14.5 14.5)"
        ></circle>
        <circle data-totp-outer fill="none" cx="14.5" cy="14.5" r="14" stroke-width="1"></circle>
      </svg>
      <span data-totp-seconds></span>
    </span>
  `;
}

function createTotpCountdownRef(
  theme: Theme,
  period: number,
  frozenSeconds: number | undefined,
  onPeriodElapsed?: () => void,
) {
  let intervalId: ReturnType<typeof globalThis.setInterval> | undefined;

  return (node: Element | undefined) => {
    if (intervalId !== undefined) {
      globalThis.clearInterval(intervalId);
      intervalId = undefined;
    }

    if (!(node instanceof HTMLElement)) {
      return;
    }

    const secondsEl = node.querySelector("[data-totp-seconds]") as HTMLElement | null;
    const innerCircle = node.querySelector("[data-totp-inner]") as SVGCircleElement | null;
    const outerCircle = node.querySelector("[data-totp-outer]") as SVGCircleElement | null;

    const paint = (seconds: number) => {
      const expiring = seconds <= TOTP_EXPIRY_SECONDS;
      const strokeColor = expiring ? themes[theme].passwordSpecial : themes[theme].primary["600"];
      const textColor = expiring ? themes[theme].passwordSpecial : themes[theme].text.main;

      if (secondsEl) {
        secondsEl.textContent = `${seconds}`;
        secondsEl.className = totpSecondsStyles(textColor);
      }
      if (innerCircle) {
        innerCircle.setAttribute("stroke", strokeColor);
        innerCircle.style.strokeDashoffset = `${((period - seconds) / period) * TOTP_CIRCUMFERENCE}`;
      }
      outerCircle?.setAttribute("stroke", strokeColor);
    };

    if (frozenSeconds !== undefined) {
      paint(frozenSeconds);
      return;
    }

    const tick = () => {
      const mod = Math.round(Date.now() / 1000) % period;
      paint(period - mod);
      if (mod === 0) {
        onPeriodElapsed?.();
      }
    };

    tick();
    intervalId = globalThis.setInterval(tick, 1000);
  };
}

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
