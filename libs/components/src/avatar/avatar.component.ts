import { NgClass } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
} from "@angular/core";

import { Utils } from "@bitwarden/common/platform/misc/utils";

export type AvatarSizes = "2xlarge" | "xlarge" | "large" | "base" | "small";

export type AvatarColors = "teal" | "coral" | "brand" | "green" | "purple";

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
  teal: "group-hover/avatar:tw-bg-bg-avatar-teal-hover",
  coral: "group-hover/avatar:tw-bg-bg-avatar-coral-hover",
  brand: "group-hover/avatar:tw-bg-bg-avatar-brand-hover",
  green: "group-hover/avatar:tw-bg-bg-avatar-green-hover",
  purple: "group-hover/avatar:tw-bg-bg-avatar-purple-hover",
};

/**
 * Avatars display a background color that helps a user visually recognize their logged in account.
 *
 * Color options include a pre-defined set of palette-approved colors, or users can select a
 * custom color. A variance in color across the avatar component is important as it is used in
 * Account Switching as a visual indicator to recognize which of a personal or work account a user
 * is logged into.
 *
 * Avatars can be static or interactive.
 */
@Component({
  selector: "bit-avatar, button[bit-avatar], a[bit-avatar]",
  templateUrl: "avatar.component.html",
  imports: [NgClass],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "tw-group/avatar",
  },
  // host directive for aria disabled states? check figma for disabled styles
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

  protected readonly svgCharCount = 2;
  protected readonly svgFontSize = 12;
  protected readonly svgFontWeight = 400;
  protected readonly svgSize = 32;

  protected readonly svgClass = computed(() => {
    return ["tw-rounded-full", "tw-border-solid", this.backgroundColorClass()]
      .concat(SizeClasses[this.size()] ?? [])
      .concat(this.hasHoverEffects() ? this.interactiveSvgClasses() : []);
  });

  protected readonly hasHoverEffects = computed(() => {
    return this.el.nativeElement.nodeName === "BUTTON" || this.el.nativeElement.nodeName === "A";
  });

  protected readonly usingCustomColor = computed(() => {
    if (Utils.isNullOrWhitespace(this.color())) {
      return false;
    }

    const defaultColorKeys = Object.keys(DefaultAvatarColors) as AvatarColors[];
    return !defaultColorKeys.includes(this.color() as AvatarColors);
  });

  protected readonly customBackgroundColor = computed(() => {
    if (this.usingCustomColor()) {
      return this.color()!;
    }

    return undefined;
  });

  protected readonly backgroundColorClass = computed(() => {
    if (!this.usingCustomColor()) {
      return DefaultAvatarColors[(this.color() as AvatarColors) ?? this.avatarDefaultColorKey()];
    }

    return "";
  });

  protected readonly interactiveSvgClasses = computed(() => {
    if (!this.usingCustomColor()) {
      return [
        DefaultAvatarHoverColors[(this.color() as AvatarColors) ?? this.avatarDefaultColorKey()],
      ];
    }

    // awaiting design choice for custom color hover state
    return "";
  });

  protected readonly textColor = computed(() => {
    const customBg = this.customBackgroundColor();

    if (customBg) {
      return Utils.pickTextColorBasedOnBgColor(customBg, 135, true);
    } else {
      return "white";
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
