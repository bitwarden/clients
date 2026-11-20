import { css } from "@emotion/css";
import { html } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { specialCharacterToKeyMap } from "../../../utils";
import { themes } from "../constants/styles";

export type ColorizedPasswordI18n = {
  generatedPassword: string;
  lowercaseAriaLabel: string;
  uppercaseAriaLabel: string;
  characterDescriptors: Record<string, string>;
};

export type ColorizedPasswordProps = {
  password: string;
  theme: Theme;
  i18n: ColorizedPasswordI18n;
};

type PasswordCharacterType = "special" | "number" | "letter";

type TypedPasswordCharacter = {
  character: string;
  type: PasswordCharacterType;
};

export function ColorizedPassword({ password, theme, i18n }: ColorizedPasswordProps) {
  const characters = Array.from(password).map((character) => ({
    character,
    type: getPasswordCharacterType(character),
  }));

  return html`
    <div
      class=${colorizedPasswordStyles(theme)}
      aria-label=${buildPasswordAriaLabel(characters, i18n)}
    >
      ${characters.map(
        ({ character, type }) =>
          html`<span class=${passwordCharacterStyles(theme, type)}>${character}</span>`,
      )}
    </div>
  `;
}

function getPasswordCharacterType(character: string): PasswordCharacterType {
  if (character.match(/\W/)) {
    return "special";
  }
  if (character.match(/\d/)) {
    return "number";
  }
  return "letter";
}

function buildPasswordAriaLabel(
  characters: TypedPasswordCharacter[],
  i18n: ColorizedPasswordI18n,
): string {
  const parts = characters.map(({ character, type }) => {
    switch (type) {
      case "special":
        return i18n.characterDescriptors[specialCharacterToKeyMap[character]] ?? character;
      case "number":
        return character;
      case "letter":
        return `${character === character.toLowerCase() ? i18n.lowercaseAriaLabel : i18n.uppercaseAriaLabel} ${character}`;
    }
  });

  return `${i18n.generatedPassword}: ${parts.join(" ")} `;
}

const colorizedPasswordStyles = (theme: Theme) => css`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  width: 100%;
  font-family: "Source Code Pro", ui-monospace, monospace;
  font-size: 12px;
  font-weight: 400;
  line-height: 1.3;
  letter-spacing: 0.05rem;
  color: ${themes[theme].text.main};
`;

const passwordCharacterStyles = (theme: Theme, type: PasswordCharacterType) => css`
  ${type === "special" ? `color: ${themes[theme].passwordSpecial};` : ""}
  ${type === "number" ? `color: ${themes[theme].passwordNumber};` : ""}
`;
