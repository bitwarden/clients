import { css, html, nothing } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import { styleMap } from "lit/directives/style-map.js";

import { AriaTargetHost } from "../core/aria";
import { BitElement } from "../core/bit-element";

import {
  AvatarColor,
  defaultAvatarColors,
  defaultAvatarHoverColors,
  getAvatarDefaultColor,
  isAvatarColor,
  pickTextColor,
} from "./avatar-color";

export type AvatarSize = "2xl" | "xl" | "lg" | "base" | "sm";

const sizeClasses: Record<AvatarSize, string> = {
  "2xl": "tw-size-16 tw-min-w-16",
  xl: "tw-size-14 tw-min-w-14",
  lg: "tw-size-11 tw-min-w-11",
  base: "tw-size-8 tw-min-w-8",
  sm: "tw-size-6 tw-min-w-6",
};

const SVG_CHAR_COUNT = 2;
const SVG_SIZE = 32;
const emojiPresentation = /\p{Emoji_Presentation}/u;

function unicodeSafeSubstring(str: string, count: number) {
  const characters = str.match(/./gu);
  return characters != null ? characters.slice(0, count).join("") : "";
}

function displayChars(text: string | undefined) {
  const upper = text?.toUpperCase() ?? "";
  const parts = upper.split(" ");
  let chars =
    parts.length > 1
      ? Array.from({ length: SVG_CHAR_COUNT }, (_, i) =>
          unicodeSafeSubstring(parts[i] ?? "", 1),
        ).join("")
      : unicodeSafeSubstring(upper, SVG_CHAR_COUNT);
  // If the chars contain an emoji, only show it.
  const emoji = chars.match(emojiPresentation);
  if (emoji) {
    chars = emoji[0];
  }
  return chars;
}

const interactiveClasses = [
  "focus-visible:tw-outline-none focus-visible:tw-ring-2 focus-visible:tw-ring-offset-1",
  "focus-visible:tw-ring-border-focus focus-visible:tw-z-10 aria-disabled:tw-cursor-not-allowed",
].join(" ");

/**
 * A visual representation of a user profile. Color variations help users identify the active
 * account and tell accounts apart in a list.
 *
 * Color priority: `color` (palette name or custom CSS color), then `avatar-id`, then `text`.
 *
 * Static by default; set `interactive` to render a button with hover and focus states.
 *
 * @csspart base - The `<span>` or `<button>` wrapping the SVG.
 */
@customElement("bit-avatar")
export class BitAvatar extends BitElement implements AriaTargetHost {
  static shadowRootOptions = { ...BitElement.shadowRootOptions, delegatesFocus: true };

  static styles = [
    BitElement.styles,
    css`
      :host {
        display: inline-block;
        line-height: 0;
        vertical-align: middle;
      }
      /* Story hooks for forcing interaction states, matching libs/components. */
      :host(.tw-test-hover) svg,
      :host(.tw-test-focus-visible) svg {
        background-color: var(--avatar-bg-hover);
      }
    `,
  ];

  /** A palette color (`"teal"`, `"coral"`, `"brand"`, `"green"`, `"purple"`) or a custom hex code. */
  @property() color?: AvatarColor | string;

  /** Stable identifier used to generate a consistent color when `color` isn't set. */
  @property({ attribute: "avatar-id" }) avatarId?: string;

  /** Name to display; the first letters of up to two words are shown. */
  @property() text?: string;

  /** Accessible name. Defaults to `text`. */
  @property() label?: string;

  @property({ reflect: true }) size: AvatarSize = "base";

  /** Render as a button. */
  @property({ type: Boolean, reflect: true }) interactive = false;

  /** For interactive avatars: `aria-disabled` the button and block clicks. */
  @property({ type: Boolean, reflect: true }) disabled = false;

  @query("button") readonly ariaTarget!: HTMLElement | null;

  constructor() {
    super();
    this.addEventListener(
      "click",
      (event) => {
        if (this.interactive && this.disabled) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      },
      { capture: true },
    );
  }

  private get colors() {
    const color = this.color?.trim();
    if (color && !isAvatarColor(color)) {
      return {
        bg: color,
        // Drop the custom color's saturation and lightness by 10% when hovering
        bgHover: `hsl(from ${color} h calc(s - 10) calc(l - 10))`,
        text: pickTextColor(color, 135),
      };
    }
    const key = isAvatarColor(color) ? color : getAvatarDefaultColor(this.avatarId, this.text);
    return { bg: defaultAvatarColors[key], bgHover: defaultAvatarHoverColors[key], text: "white" };
  }

  render() {
    const colors = this.colors;
    const svg = html`<svg
      xmlns="http://www.w3.org/2000/svg"
      pointer-events="none"
      class="tw-rounded-full tw-size-full tw-min-w-full tw-bg-[--avatar-bg] group-aria-disabled/avatar:tw-bg-bg-inactive [&:is(button:not([aria-disabled='true'])_*)]:group-hover/avatar:tw-bg-[--avatar-bg-hover] [&:is(button:not([aria-disabled='true'])_*)]:group-focus-visible/avatar:tw-bg-[--avatar-bg-hover]"
      viewBox="0 0 ${SVG_SIZE} ${SVG_SIZE}"
    >
      <title>${this.label || this.text || ""}</title>
      <text
        text-anchor="middle"
        y="50%"
        x="50%"
        dy="0.35em"
        pointer-events="auto"
        class="[&:is(button:is([aria-disabled='true'])_*)]:tw-fill-fg-inactive ${
          colors.text === "white" ? "tw-fill-fg-white" : "tw-fill-black"
        }"
        style="font-weight: 400; font-size: 12px; line-height: 16px"
        font-family='Inter,"Helvetica Neue",Helvetica,Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol"'
      >
        ${displayChars(this.text)}
      </text>
    </svg>`;

    const style = styleMap({ "--avatar-bg": colors.bg, "--avatar-bg-hover": colors.bgHover });
    const classes = `tw-inline-block tw-leading-[0px] tw-rounded-full tw-group/avatar ${sizeClasses[this.size] ?? sizeClasses.base}`;

    if (this.interactive) {
      return html`<button
        part="base"
        type="button"
        class="${classes} ${interactiveClasses}"
        style=${style}
        aria-disabled=${this.disabled ? "true" : nothing}
      >
        ${svg}
      </button>`;
    }
    return html`<span part="base" class=${classes} style=${style}>${svg}</span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-avatar": BitAvatar;
  }
}
