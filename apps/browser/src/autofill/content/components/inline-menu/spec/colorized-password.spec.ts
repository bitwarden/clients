import { ThemeTypes } from "@bitwarden/common/platform/enums";

import { litValues } from "../../lit-stories/lit-values";
import { mockI18n, mockPasswordGeneratorI18n } from "../../lit-stories/mock-data";
import { ColorizedPassword } from "../colorized-password";

jest.mock("lit", () => jest.requireActual("../../lit-stories/lit-jest-mocks").litMock);

describe("ColorizedPassword", () => {
  const ARIA_LABEL_SLOT = 1;

  it("builds an aria-label describing letters, numbers, and special characters", () => {
    const values = litValues(
      ColorizedPassword({
        password: "aB1#",
        theme: ThemeTypes.Light,
        i18n: mockPasswordGeneratorI18n,
      }),
    );

    expect(values[ARIA_LABEL_SLOT]).toBe(
      `${mockI18n.generatedPassword}: ${mockI18n.lowercaseAriaLabel} a ${mockI18n.uppercaseAriaLabel} B 1 ${mockI18n.hashSignCharacterDescriptor} `,
    );
  });

  it("falls back to the raw character when no descriptor exists", () => {
    const values = litValues(
      ColorizedPassword({
        password: "?",
        theme: ThemeTypes.Light,
        i18n: { ...mockPasswordGeneratorI18n, characterDescriptors: {} },
      }),
    );

    expect(values[ARIA_LABEL_SLOT]).toBe(`${mockI18n.generatedPassword}: ? `);
  });
});
