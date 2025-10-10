import { NgClass } from "@angular/common";
import { Component, computed, input } from "@angular/core";

import { Utils } from "@bitwarden/common/platform/misc/utils";

type SizeTypes = "xlarge" | "large" | "default" | "small" | "xsmall";

const SizeClasses: Record<SizeTypes, string[]> = {
  xlarge: ["tw-h-24", "tw-w-24", "tw-min-w-24"],
  large: ["tw-h-16", "tw-w-16", "tw-min-w-16"],
  default: ["tw-h-10", "tw-w-10", "tw-min-w-10"],
  small: ["tw-h-7", "tw-w-7", "tw-min-w-7"],
  xsmall: ["tw-h-6", "tw-w-6", "tw-min-w-6"],
};

/**
  * Avatars display a unique color that helps a user visually recognize their logged in account.

  * A variance in color across the avatar component is important as it is used in Account Switching as a
  * visual indicator to recognize which of a personal or work account a user is logged into.
*/
@Component({
  selector: "bit-avatar",
  template: `
    <span [title]="title() || text()">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        pointer-events="none"
        [style.backgroundColor]="backgroundColor()"
        [ngClass]="classList()"
        attr.viewBox="0 0 {{ svgSize }} {{ svgSize }}"
      >
        <text
          text-anchor="middle"
          y="50%"
          x="50%"
          dy="0.35em"
          pointer-events="auto"
          [attr.fill]="textColor()"
          [style.fontWeight]="svgFontWeight"
          [style.fontSize.px]="svgFontSize"
          font-family='Roboto,"Helvetica Neue",Helvetica,Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol"'
        >
          {{ displayChars() }}
        </text>
      </svg>
    </span>
  `,
  imports: [NgClass],
})
export class AvatarComponent {
  readonly border = input(false);
  readonly color = input<string>();
  readonly id = input<string>();
  readonly text = input<string>();
  readonly title = input<string>();
  readonly size = input<SizeTypes>("default");

  protected readonly svgCharCount = 2;
  protected readonly svgFontSize = 20;
  protected readonly svgFontWeight = 300;
  protected readonly svgSize = 48;

  protected readonly classList = computed(() => {
    return ["tw-rounded-full"]
      .concat(SizeClasses[this.size()] ?? [])
      .concat(this.border() ? ["tw-border", "tw-border-solid", "tw-border-secondary-600"] : []);
  });

  protected readonly backgroundColor = computed(() => {
    const id = this.id();
    const upperCaseText = this.text()?.toUpperCase() ?? "";

    if (!Utils.isNullOrWhitespace(this.color())) {
      return this.color()!;
    }

    if (!Utils.isNullOrWhitespace(id)) {
      return Utils.stringToColor(id!.toString());
    }

    return Utils.stringToColor(upperCaseText);
  });

  protected readonly textColor = computed(() => {
    return Utils.pickTextColorBasedOnBgColor(this.backgroundColor(), 135, true);
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
}
