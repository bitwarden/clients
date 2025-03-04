// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore

import { Component, HostBinding, Input } from "@angular/core";

import { Utils } from "@bitwarden/common/platform/misc/utils";

enum CharacterType {
  Letter,
  Emoji,
  Special,
  Number,
}

@Component({
  selector: "bit-color-password",
  template: `@for (character of passwordArray; track character; let i = $index) {
    <span [class]="getCharacterClass(character)">
      <span>{{ character }}</span>
      @if (showCount) {
        <span class="tw-whitespace-nowrap tw-text-xs tw-leading-5 tw-text-main">{{ i + 1 }}</span>
      }
    </span>
  }`,
  standalone: true,
})
export class ColorPasswordComponent {
  @Input() password: string = null;
  @Input() showCount = false;

  characterStyles: Record<CharacterType, string[]> = {
    [CharacterType.Emoji]: [],
    [CharacterType.Letter]: ["tw-text-main"],
    [CharacterType.Special]: ["tw-text-danger"],
    [CharacterType.Number]: ["tw-text-primary-600"],
  };

  @HostBinding("class")
  get classList() {
    return ["tw-min-w-0", "tw-whitespace-pre-wrap", "tw-break-all"];
  }

  get passwordArray() {
    // Convert to an array to handle cases that strings have special characters, i.e.: emoji.
    return Array.from(this.password);
  }

  getCharacterClass(character: string) {
    const charType = this.getCharacterType(character);
    const charClass = this.characterStyles[charType];

    if (this.showCount) {
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
      return CharacterType.Emoji;
    }

    if (character.match(/\d/)) {
      return CharacterType.Number;
    }

    const specials = ["&", "<", ">", " "];
    if (specials.includes(character) || character.match(/[^\w ]/)) {
      return CharacterType.Special;
    }

    return CharacterType.Letter;
  }
}
