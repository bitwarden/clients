import { css } from "@emotion/css";
import { html } from "lit";
import { ref } from "lit/directives/ref.js";

import { Theme } from "@bitwarden/common/platform/enums";

import { spacing, themes, typography } from "../constants/styles";

const TOTP_LEGACY_CIRCUMFERENCE = 78.5;
const TOTP_PROGRESS_RADIUS = 12;
const TOTP_TRACK_RADIUS = 9.5;
const TOTP_PROGRESS_CIRCUMFERENCE = 2 * Math.PI * TOTP_PROGRESS_RADIUS;
const TOTP_EXPIRY_SECONDS = 7;

export type TotpCountdownProps = {
  theme: Theme;
  period: number;
  secondsRemaining?: number;
  onPeriodElapsed?: () => void;
  /** Non-expiring ring and digit color. Defaults to the current blue ring. */
  color?: string;
  /** Thick progress ring sits outside the thin track. Design-system cipher row only. */
  outerProgressRing?: boolean;
};

export function TotpCountdown({
  theme,
  period,
  secondsRemaining,
  onPeriodElapsed,
  color,
  outerProgressRing = false,
}: TotpCountdownProps) {
  const circumference = outerProgressRing ? TOTP_PROGRESS_CIRCUMFERENCE : TOTP_LEGACY_CIRCUMFERENCE;
  const ringColor = color ?? themes[theme].primary["600"];

  return html`
    <span
      class=${outerProgressRing ? outerRingTotpCountdownStyles : totpCountdownStyles}
      aria-hidden="true"
      ${ref(
        createTotpCountdownRef(
          theme,
          period,
          secondsRemaining,
          circumference,
          onPeriodElapsed,
          color,
        ),
      )}
    >
      ${
        outerProgressRing
          ? html`
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 29 29">
                <circle
                  data-totp-outer
                  fill="none"
                  cx="14.5"
                  cy="14.5"
                  r=${TOTP_TRACK_RADIUS}
                  stroke=${ringColor}
                  stroke-width="1"
                ></circle>
                <circle
                  data-totp-inner
                  fill="none"
                  cx="14.5"
                  cy="14.5"
                  r=${TOTP_PROGRESS_RADIUS}
                  stroke=${ringColor}
                  stroke-width="3"
                  stroke-dasharray=${circumference}
                  stroke-dashoffset="0"
                  transform="rotate(-90 14.5 14.5)"
                ></circle>
              </svg>
            `
          : html`
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 29 29">
                <circle
                  data-totp-inner
                  fill="none"
                  cx="14.5"
                  cy="14.5"
                  r="12.5"
                  stroke="transparent"
                  stroke-width="3"
                  stroke-dasharray=${circumference}
                  stroke-dashoffset=${circumference}
                  transform="rotate(-90 14.5 14.5)"
                ></circle>
                <circle
                  data-totp-outer
                  fill="none"
                  cx="14.5"
                  cy="14.5"
                  r="14"
                  stroke="transparent"
                  stroke-width="1"
                ></circle>
              </svg>
            `
      }
      <span data-totp-seconds></span>
    </span>
  `;
}

function createTotpCountdownRef(
  theme: Theme,
  period: number,
  frozenSeconds: number | undefined,
  circumference: number,
  onPeriodElapsed?: () => void,
  color?: string,
) {
  let intervalId: ReturnType<typeof globalThis.setInterval> | undefined;
  let host: HTMLElement | undefined;

  return (node: Element | undefined) => {
    if (intervalId !== undefined) {
      globalThis.clearInterval(intervalId);
      intervalId = undefined;
    }

    host = node instanceof HTMLElement ? node : undefined;
    if (!host) {
      return;
    }

    // The ring SVG is a child template, so it is inserted after this ref runs.
    const countdown = host;
    queueMicrotask(() => {
      if (host !== countdown || !countdown.isConnected) {
        return;
      }

      const secondsEl = countdown.querySelector("[data-totp-seconds]") as HTMLElement | null;
      const innerCircle = countdown.querySelector("[data-totp-inner]") as SVGCircleElement | null;
      const outerCircle = countdown.querySelector("[data-totp-outer]") as SVGCircleElement | null;

      const paint = (seconds: number) => {
        const expiring = seconds <= TOTP_EXPIRY_SECONDS;
        const strokeColor = expiring
          ? themes[theme].passwordSpecial
          : (color ?? themes[theme].primary["600"]);
        const textColor = expiring
          ? themes[theme].passwordSpecial
          : (color ?? themes[theme].text.main);

        if (secondsEl) {
          secondsEl.textContent = `${seconds}`;
          secondsEl.style.color = textColor;
        }
        if (innerCircle) {
          innerCircle.setAttribute("stroke", strokeColor);
          innerCircle.style.strokeDashoffset = `${((period - seconds) / period) * circumference}`;
        }
        outerCircle?.setAttribute("stroke", strokeColor);
      };

      if (frozenSeconds !== undefined) {
        paint(frozenSeconds);
        return;
      }

      const tick = () => {
        if (host !== countdown) {
          return;
        }
        const mod = Math.round(Date.now() / 1000) % period;
        paint(period - mod);
        if (mod === 0) {
          onPeriodElapsed?.();
        }
      };

      tick();
      intervalId = globalThis.setInterval(tick, 1000);
    });
  };
}

const totpCountdownStyles = css`
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
  width: calc(${spacing["4"]} * 2);
  height: calc(${spacing["4"]} * 2);

  > svg {
    width: 100%;
    height: 100%;
  }

  [data-totp-seconds] {
    ${typography.helperMedium}

    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }
`;

const outerRingTotpCountdownStyles = css`
  ${totpCountdownStyles};
  width: 24px;
  height: 24px;
  aspect-ratio: 1 / 1;
`;
