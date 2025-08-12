import { Component, computed, HostBinding, input } from "@angular/core";

import { Utils } from "@bitwarden/common/platform/misc/utils";

type CharacterType = "letter" | "emoji" | "special" | "number";

/**
 * The color password is used primarily in the Generator pages and in the Login type form. It includes
 * the logic for displaying letters as `text-main`, numbers as `primary`, and special symbols as
 * `danger`.
 */
@Component({
  selector: "bit-color-password",
  template: `@for (character of passwordCharArray(); track $index; let i = $index) {
    <span [class]="getCharacterClass(character)">
      <span>{{ character }}</span>
      @if (showCount()) {
        <span class="tw-whitespace-nowrap tw-text-xs tw-leading-5 tw-text-main">{{ i + 1 }}</span>
      }
    </span>
  }`,
})
export class ColorPasswordComponent {
  password = input<string>("");
  showCount = input<boolean>(false);

  // Convert to an array to handle cases that strings have special characters, i.e.: emoji.
  passwordCharArray = computed(() => {
    return Array.from(this.password() ?? "");
  });

  characterStyles: Record<CharacterType, string[]> = {
    emoji: [],
    letter: ["tw-text-main"],
    special: ["tw-text-danger"],
    number: ["tw-text-primary-600"],
  };

  @HostBinding("class")
  get classList() {
    return ["tw-min-w-0", "tw-whitespace-pre-wrap", "tw-break-words"];
  }

  getCharacterClass(character: string) {
    const charType = this.getCharacterType(character);
    const charClass = this.characterStyles[charType];

    if (this.showCount()) {
      return charClass.concat([
        "tw-inline-flex",
        "tw-flex-col",
        "tw-items-center",
        "tw-w-7",
        "tw-py-1",
        "odd:tw-bg-secondary-100",
        "even:tw-bg-background",
      ]);
    }

    return charClass;
  }

  private getCharacterType(character: string): CharacterType {
    if (character.match(Utils.regexpEmojiPresentation)) {
      return "emoji";
    }

    if (character.match(/\d/)) {
      return "number";
    }

    const specials = ["&", "<", ">", " "];
    if (specials.includes(character) || character.match(/[^\w ]/)) {
      return "special";
    }

    return "letter";
  }
}
