import { nothing } from "lit";

import { ThemeTypes } from "@bitwarden/common/platform/enums";

import { litValues } from "../../lit-stories/lit-values";
import { mockI18n, mockTotpCiphers } from "../../lit-stories/mock-data";
import { TotpCipherInfo } from "../totp-cipher-info";

jest.mock("lit", () => jest.requireActual("../../lit-stories/lit-jest-mocks").litMock);

describe("TotpCipherInfo", () => {
  const baseProps = {
    theme: ThemeTypes.Light,
    heading: mockI18n.fillVerificationCode,
    totp: mockTotpCiphers[0].login!.totp!,
    totpCodeAria: mockI18n.totpCodeAria,
    masked: false,
  };

  const USERNAME_SLOT = 3;
  const CODE_TEXT_SLOT = 7;

  it("formats the totp code with a space", () => {
    const values = litValues(TotpCipherInfo(baseProps));

    expect(values[CODE_TEXT_SLOT]).toBe("454 143");
  });

  it("masks the totp code when masked is true", () => {
    const values = litValues(TotpCipherInfo({ ...baseProps, masked: true }));

    expect(values[CODE_TEXT_SLOT]).toBe("●●●●●●");
  });

  it("renders the username when provided", () => {
    const username = mockTotpCiphers[0].login!.username!;
    const values = litValues(TotpCipherInfo({ ...baseProps, username }));

    expect(values[USERNAME_SLOT]).toContain(username);
  });

  it("renders nothing for username when omitted", () => {
    const values = litValues(TotpCipherInfo(baseProps));

    expect(values[USERNAME_SLOT]).toBe(nothing);
  });
});
