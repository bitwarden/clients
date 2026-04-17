import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
} from "@angular/core";

import { Utils } from "@bitwarden/common/platform/misc/utils";

import { AriaDisableDirective } from "../a11y";
import { ariaDisableElement } from "../utils";

export type AvatarSize = "2xl" | "xl" | "lg" | "base" | "sm";

export const AvatarDefaultColors = ["teal", "coral", "brand", "green", "purple"] as const;
export type AvatarColor = (typeof AvatarDefaultColors)[number];

const sizeClasses: Record<AvatarSize, string[]> = {
  "2xl": ["tw-size-16", "tw-min-w-16"],
  xl: ["tw-size-14", "tw-min-w-14"],
  lg: ["tw-size-11", "tw-min-w-11"],
  base: ["tw-size-8", "tw-min-w-8"],
  sm: ["tw-size-6", "tw-min-w-6"],
};

/**
 * Palette avatar color options. Prefer using these over custom colors. These are chosen for
 * cohesion with the rest of our Bitwarden color palette and for accessibility color contrast.
 * We reference color variables defined in tw-theme.css to ensure the avatar color handles light and
 * dark mode.
 */
export const defaultAvatarColors: Record<AvatarColor, string> = {
  teal: "#007c95",
  coral: "#c71800",
  brand: "#175ddc",
  green: "#008236",
  purple: "#8200db",
};

/**
 * Hover colors for each default avatar color, for use when the avatar is interactive. We reference
 * color variables defined in tw-theme.css to ensure the avatar color handles light and
 * dark mode.
 */
export const defaultAvatarHoverColors: Record<AvatarColor, string> = {
  teal: "#006278",
  coral: "#a81400",
  brand: "#0d43af",
  green: "#016630",
  purple: "#6e11b0",
};

// Typeguard to check if a given color is an AvatarColor
export function isAvatarColor(color: string | undefined): color is AvatarColor {
  if (color === undefined) {
    return false;
  }
  return AvatarDefaultColors.includes(color as AvatarColor);
}

/**
 * The avatar component is a visual representation of a user profile. Color variations help users
 * quickly identify the active account and differentiate between multiple accounts in a list.
 *
 * Color options include a pre-defined set of palette-approved colors, or users can select a
 * custom color. A variance in color across the avatar component is important as it is used in
 * Account Switching as a visual indicator to recognize which of a personal or work account a user
 * is logged into.
 *
 * Avatars can be static or interactive.
 */
@Component({
  selector: "bit-avatar, button[bit-avatar]",
  templateUrl: "avatar.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      "tw-inline-block tw-leading-[0px] focus-visible:tw-outline-none tw-rounded-full focus-visible:tw-ring-2 focus-visible:tw-ring-offset-1 focus-visible:tw-ring-border-focus !focus-visible:tw-border-[transparent] focus-visible:tw-z-10 tw-group/avatar aria-disabled:tw-cursor-not-allowed [&.tw-test-hover_svg]:tw-bg-[--avatar-bg-hover] [&.tw-test-focus-visible_svg]:tw-bg-[--avatar-bg-hover]",
    "[class]": "sizeClass()",
    "[style.--avatar-bg]": "avatarColors().bg",
    "[style.--avatar-bg-hover]": "avatarColors().bgHover",
  },
  hostDirectives: [AriaDisableDirective],
})
export class AvatarComponent {
  private readonly el = inject(ElementRef);

  /**
   * Background color for the avatar. Provide one of the AvatarColors, or a custom hex code.
   *
   * If no color is provided, a color will be generated based on the id or text.
   */
  readonly color = input<AvatarColor | string>();

  /**
   * Unique identifier used to generate a consistent background color. Takes precedence over text
   * for color generation when a color is not provided.
   */
  readonly id = input<string>();

  /**
   * Text to display in the avatar. The first letters of words (up to 2 characters) will be shown.
   * Also used to generate background color if color and id are not provided.
   */
  readonly text = input<string>();

  /**
   * Title attribute for the avatar. If not provided, falls back to the text value.
   */
  readonly title = input<string>();

  /**
   * Size of the avatar.
   */
  readonly size = input<AvatarSize>("base");

  /**
   * For button element avatars, whether the button is disabled. No effect for non-button avatars
   */
  readonly disabled = input<boolean>(false);

  constructor() {
    ariaDisableElement(this.el.nativeElement, this.disabled);
  }

  protected readonly svgCharCount = 2;
  protected readonly svgFontSize = 12;
  protected readonly svgFontWeight = 400;
  protected readonly svgSize = 32;

  protected readonly sizeClass = computed(() => sizeClasses[this.size()]);

  /**
   * Determine the background color of the avatar, its hover color, and its text color based on
   * whether or not the `color` input is a custom color or a default avatar color
   */
  protected readonly avatarColors = computed<{
    // hex or css variable
    bg: string;
    // hsl or css variable
    bgHover: string;
    // 'white' or 'black'
    text: string;
  }>(() => {
    const color = this.color();

    const colorIsAvatarColor = isAvatarColor(color);
    const colorIsDefined = color !== null && color !== undefined && color.trim() !== "";

    const colorIsCustom = !colorIsAvatarColor && colorIsDefined;

    if (colorIsCustom) {
      return {
        bg: color,
        // Drop the custom color's saturation and lightness by 10% when hovering
        bgHover: `hsl(from ${color} h calc(s - 10) calc(l - 10))`,
        text: Utils.pickTextColorBasedOnBgColor(color, 135, true),
      };
    } else {
      const chosenAvatarColor = colorIsAvatarColor
        ? color
        : this.getDefaultColorKey(this.id(), this.text());

      return {
        bg: defaultAvatarColors[chosenAvatarColor],
        bgHover: defaultAvatarHoverColors[chosenAvatarColor],
        text: "white",
      };
    }
  });

  protected readonly displayChars = computed(() => {
    const upperCaseText = this.text()?.toUpperCase() ?? "";

    let chars = this.getFirstLetters(upperCaseText, this.svgCharCount);
    if (chars == null) {
      chars = this.unicodeSafeSubstring(upperCaseText, this.svgCharCount);
    }

    // If the chars contain an emoji, only show it.
    const emojiMatch = chars.match(Utils.regexpEmojiPresentation);
    if (emojiMatch) {
      chars = emojiMatch[0];
    }

    return chars;
  });

  private getFirstLetters(data: string, count: number): string | undefined {
    const parts = data.split(" ");
    if (parts.length > 1) {
      let text = "";
      for (let i = 0; i < count; i++) {
        text += this.unicodeSafeSubstring(parts[i], 1);
      }
      return text;
    }
    return undefined;
  }

  private unicodeSafeSubstring(str: string, count: number) {
    const characters = str.match(/./gu);
    return characters != null ? characters.slice(0, count).join("") : "";
  }

  /**
   * Deterministically choose a default avatar color based on the given strings
   *
   * Based on the id first and the text second, choose a color from AvatarColors. This ensures that
   * the user sees the same color for the same avatar input every time.
   */
  protected getDefaultColorKey(id?: string, text?: string) {
    let magicString = "";

    if (!Utils.isNullOrWhitespace(id)) {
      magicString = id!.toString();
    } else {
      magicString = text?.toUpperCase() ?? "";
    }

    let hash = 0;
    for (const char of magicString) {
      hash = char.charCodeAt(0) + ((hash << 5) - hash);
    }

    const index = Math.abs(hash) % AvatarDefaultColors.length;
    return AvatarDefaultColors[index];
  }
}
