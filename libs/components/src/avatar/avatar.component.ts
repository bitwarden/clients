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
  "2xl": ["tw-h-16", "tw-w-16", "tw-min-w-16"],
  xl: ["tw-h-14", "tw-w-14", "tw-min-w-14"],
  lg: ["tw-h-11", "tw-w-11", "tw-min-w-11"],
  base: ["tw-h-8", "tw-w-8", "tw-min-w-8"],
  sm: ["tw-h-6", "tw-w-6", "tw-min-w-6"],
};

/**
 * Palette avatar color options. Prefer using these over custom colors. These are chosen for
 * cohesion with the rest of our Bitwarden color palette and for accessibility color contrast.
 * We reference color variables defined in tw-theme.css to ensure the avatar color handles light and
 * dark mode.
 */
export const defaultAvatarColors: Record<AvatarColor, string> = {
  teal: "var(--color-bg-avatar-teal)",
  coral: "var(--color-bg-avatar-coral)",
  brand: "var(--color-bg-avatar-brand)",
  green: "var(--color-bg-avatar-green)",
  purple: "var(--color-bg-avatar-purple)",
};

/**
 * Hover colors for each default avatar color, for use when the avatar is interactive. We reference
 * color variables defined in tw-theme.css to ensure the avatar color handles light and
 * dark mode.
 */
export const defaultAvatarHoverColors: Record<AvatarColor, string> = {
  teal: "var(--color-bg-avatar-teal-hover)",
  coral: "var(--color-bg-avatar-coral-hover)",
  brand: "var(--color-bg-avatar-brand-hover)",
  green: "var(--color-bg-avatar-green-hover)",
  purple: "var(--color-bg-avatar-purple-hover)",
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
    "(mouseenter)": "isHovering.set(true)",
    "(mouseleave)": "isHovering.set(false)",
    class:
      "tw-leading-[0px] focus-visible:tw-outline-none tw-rounded-full focus-visible:tw-ring-2 focus-visible:tw-ring-offset-1 focus-visible:tw-ring-border-focus !focus-visible:tw-border-[transparent] focus-visible:tw-z-10 tw-group/avatar aria-disabled:tw-cursor-not-allowed",
    "[style.--avatar-bg]": "avatarBgColors().avatarBgColor",
    "[style.--avatar-bg-hover]": "avatarBgColors().avatarBgColorHover",
  },
  hostDirectives: [AriaDisableDirective],
})
export class AvatarComponent {
  private el = inject(ElementRef);

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

  protected readonly svgClass = computed(() => {
    return sizeClasses[this.size()] ?? [];
  });

  protected readonly usingCustomColor = computed(() => {
    const color = this.color();

    if (Utils.isNullOrWhitespace(color)) {
      return false;
    }

    return !isAvatarColor(color);
  });

  /**
   * Determine the background color of the avatar and its hover color
   *
   * If the color is custom, return that as the background color and apply an hsl calculation to
   * achieve a hover state.
   *
   * If the color is not custom, return background and hover colors from the default palette.
   *
   * All return values must be strings that can be parsed as css variables.
   */
  protected readonly avatarBgColors = computed(() => {
    if (this.usingCustomColor()) {
      return {
        avatarBgColor: this.color()!,
        // Drop the custom color's saturation and lightness by 10% when hovering
        avatarBgColorHover: `hsl(from ${this.color()} h calc(s - 10) calc(l - 10))`,
      };
    } else {
      const color = this.color();
      const colorIsAvatarColor = isAvatarColor(color);
      const chosenAvatarColor = colorIsAvatarColor
        ? color
        : this.getDefaultColorKey(this.id(), this.text());

      return {
        avatarBgColor: defaultAvatarColors[chosenAvatarColor],
        avatarBgColorHover: defaultAvatarHoverColors[chosenAvatarColor],
      };
    }
  });

  /**
   * Text color class that satisfies accessible contrast requirements
   */
  protected readonly textColor = computed(() => {
    let textColor = "white";
    const color = this.color();

    if (this.usingCustomColor() && color) {
      textColor = Utils.pickTextColorBasedOnBgColor(color, 135, true);
    }

    return textColor === "white" ? "tw-fill-fg-white" : "tw-fill-fg-black";
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
