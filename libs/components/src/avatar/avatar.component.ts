import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  signal,
} from "@angular/core";

import { Utils } from "@bitwarden/common/platform/misc/utils";

import { AriaDisableDirective } from "../a11y";
import { ariaDisableElement } from "../utils";

export type AvatarSizes = "2xlarge" | "xlarge" | "large" | "base" | "small";

export const AvatarDefaultColors = ["teal", "coral", "brand", "green", "purple"];
export type AvatarColors = (typeof AvatarDefaultColors)[number];

const SizeClasses: Record<AvatarSizes, string[]> = {
  "2xlarge": ["tw-h-16", "tw-w-16", "tw-min-w-16"],
  xlarge: ["tw-h-14", "tw-w-14", "tw-min-w-14"],
  large: ["tw-h-11", "tw-w-11", "tw-min-w-11"],
  base: ["tw-h-8", "tw-w-8", "tw-min-w-8"],
  small: ["tw-h-6", "tw-w-6", "tw-min-w-6"],
};

/**
 * Palette avatar color options. Prefer using these over custom colors. These are chosen for
 * cohesion with the rest of our Bitwarden color palette and for accessibility color contrast.
 * We reference color variables defined in tw-theme.css to ensure the avatar color handles light and
 * dark mode.
 */
export const DefaultAvatarColors: Record<AvatarColors, string> = {
  teal: "tw-bg-bg-avatar-teal",
  coral: "tw-bg-bg-avatar-coral",
  brand: "tw-bg-bg-avatar-brand",
  green: "tw-bg-bg-avatar-green",
  purple: "tw-bg-bg-avatar-purple",
};

/**
 * Hover colors for each default avatar color, for use when the avatar is interactive. We reference
 * color variables defined in tw-theme.css to ensure the avatar color handles light and
 * dark mode.
 */
const DefaultAvatarHoverColors: Record<AvatarColors, string> = {
  teal: "tw-bg-bg-avatar-teal-hover",
  coral: "tw-bg-bg-avatar-coral-hover",
  brand: "tw-bg-bg-avatar-brand-hover",
  green: "tw-bg-bg-avatar-green-hover",
  purple: "tw-bg-bg-avatar-purple-hover",
};

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
    "[class]": "avatarClass()",
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
  readonly color = input<AvatarColors | string>();

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
  readonly size = input<AvatarSizes>("base");

  /**
   * For button element avatars, whether the button is disabled. No effect for non-button avatars
   */
  readonly disabled = input<boolean>(false);

  constructor() {
    ariaDisableElement(this.el.nativeElement, this.disabled);
  }

  readonly showDisabledStyles = computed(() => {
    return this.isInteractive() && this.disabled();
  });

  protected readonly svgCharCount = 2;
  protected readonly svgFontSize = 12;
  protected readonly svgFontWeight = 400;
  protected readonly svgSize = 32;

  protected readonly isInteractive = computed(() => {
    return this.el.nativeElement.nodeName === "BUTTON";
  });

  protected readonly avatarClass = computed(() => {
    const classes = [
      "tw-leading-[0px]",
      "focus-visible:tw-outline-none",
      "tw-rounded-full",
      "focus-visible:tw-ring-2",
      "focus-visible:tw-ring-offset-1",
      "focus-visible:tw-ring-border-focus",
      "!focus-visible:tw-border-[transparent]",
      "focus-visible:tw-z-10",
    ].concat(this.showDisabledStyles() ? ["tw-cursor-not-allowed"] : []);
    return classes;
  });

  protected readonly svgClass = computed(() => {
    return ["tw-rounded-full"]
      .concat(SizeClasses[this.size()] ?? [])
      .concat(this.showDisabledStyles() ? ["tw-bg-bg-disabled"] : this.avatarBackgroundColor());
  });

  /**
   * Manually track the hover state.
   *
   * We're doing this instead of using tailwind's hover helper selectors because we need to be able
   * to apply a darker color on hover for custom background colors, and we can't use tailwind for
   * the dynamic custom background colors due to limitations with how it generates styles at build
   * time
   */
  protected readonly isHovering = signal(false);

  protected readonly showHoverColor = computed(() => this.isInteractive() && this.isHovering());

  protected readonly usingCustomColor = computed(() => {
    if (Utils.isNullOrWhitespace(this.color())) {
      return false;
    }

    const defaultColorKeys = Object.keys(DefaultAvatarColors) as AvatarColors[];
    return !defaultColorKeys.includes(this.color() as AvatarColors);
  });

  /**
   * Background color tailwind class
   *
   * Returns the appropriate class if using default avatar colors
   * Returns an empty string (a "blank" tailwind class) if using custom color
   */
  protected readonly avatarBackgroundColor = computed(() => {
    // If using custom color instead of default avatar color, early exit
    if (this.usingCustomColor()) {
      return "";
    }

    if (this.showHoverColor()) {
      return DefaultAvatarHoverColors[
        (this.color() as AvatarColors) ?? this.avatarDefaultColorKey()
      ];
    }

    return DefaultAvatarColors[(this.color() as AvatarColors) ?? this.avatarDefaultColorKey()];
  });

  /**
   * Background color hex code
   *
   * Returns the custom color if using a custom background color
   * Returns `undefined` if using a default avatar color
   *
   * Custom hexes need to be applied as a style property, because dynamic values can't be used in
   * tailwind arbitrary values due to limitations with how it generates tailwind styles at build
   * time
   */
  protected readonly customBackgroundColor = computed(() => {
    /**
     * If using a default avatar color instead of custom color, early exit.
     * If button is disabled, we want to use a tailwind class instead, so also early exit
     */
    if (!this.usingCustomColor() || this.showDisabledStyles()) {
      return undefined;
    }

    if (this.showHoverColor()) {
      // Drop the color's saturation and lightness by 10% when hovering
      return `hsl(from ${this.color()} h calc(s - 10) calc(l - 10))`;
    }

    return this.color();
  });

  /**
   * Text color class that satisfies accessible contrast requirements
   */
  protected readonly textColor = computed(() => {
    if (this.showDisabledStyles()) {
      return "tw-fill-fg-disabled";
    }

    const customBg = this.customBackgroundColor();
    let textColor = "white";

    if (customBg) {
      textColor = Utils.pickTextColorBasedOnBgColor(customBg, 135, true);
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
   * Deterministically chosen default avatar color
   *
   * Based on the id first and the text second, choose a color from AvatarColors. This ensures that
   * the user sees the same color for the same avatar input every time.
   */
  readonly avatarDefaultColorKey = computed(() => {
    let magicString = "";
    const id = this.id();

    if (!Utils.isNullOrWhitespace(id)) {
      magicString = id!.toString();
    } else {
      magicString = this.text()?.toUpperCase() ?? "";
    }

    const colorKeys = Object.keys(DefaultAvatarColors) as AvatarColors[];

    let hash = 0;
    for (let i = 0; i < magicString.length; i++) {
      hash = magicString.charCodeAt(i) + ((hash << 5) - hash);
    }

    const index = Math.abs(hash) % colorKeys.length;
    return colorKeys[index];
  });
}
