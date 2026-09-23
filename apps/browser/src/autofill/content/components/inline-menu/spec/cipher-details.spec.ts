import { nothing } from "lit";

import { ThemeTypes } from "@bitwarden/common/platform/enums";
import { CipherType } from "@bitwarden/common/vault/enums";

import { litValues } from "../../lit-stories/lit-values";
import {
  makeCipher,
  mockCardCiphers,
  mockLoginCiphers,
  mockPasskeyCiphers,
} from "../../lit-stories/mock-data";
import { CipherDetails } from "../cipher-details";

jest.mock("lit", () => jest.requireActual("../../lit-stories/lit-jest-mocks").litMock);

describe("CipherDetails", () => {
  const SUBTITLE_SLOT = 1;
  const PASSKEY_SECOND_LINE_SLOT = 2;

  it("renders login username as the subtitle", () => {
    const values = litValues(
      CipherDetails({
        theme: ThemeTypes.Light,
        cipher: mockLoginCiphers[0],
      }),
    );

    expect(values[SUBTITLE_SLOT]).toContain(mockLoginCiphers[0].login!.username);
  });

  it("renders card details as the subtitle", () => {
    const values = litValues(
      CipherDetails({
        theme: ThemeTypes.Light,
        cipher: mockCardCiphers[0],
      }),
    );

    expect(values[SUBTITLE_SLOT]).toContain(mockCardCiphers[0].card);
  });

  it("renders nothing for subtitle when none is available", () => {
    const values = litValues(
      CipherDetails({
        theme: ThemeTypes.Light,
        cipher: makeCipher({
          id: "1",
          name: "Empty login",
          type: CipherType.Login,
          login: { passkey: null },
        }),
      }),
    );

    expect(values[SUBTITLE_SLOT]).toBe(nothing);
  });

  describe("passkey", () => {
    it("shows rpName when it differs from the cipher name", () => {
      const cipher = mockPasskeyCiphers[0];
      const values = litValues(
        CipherDetails({
          theme: ThemeTypes.Light,
          cipher,
        }),
      );

      expect(values[SUBTITLE_SLOT]).toContain(cipher.login!.passkey!.rpName);
      expect(values[PASSKEY_SECOND_LINE_SLOT]).toContain(cipher.login!.passkey!.userName);
    });

    it("uses the username as the first line when rpName matches the cipher name", () => {
      const cipher = mockPasskeyCiphers[1];
      const values = litValues(
        CipherDetails({
          theme: ThemeTypes.Light,
          cipher,
        }),
      );

      expect(values[SUBTITLE_SLOT]).toContain(cipher.login!.passkey!.userName);
      expect(values[PASSKEY_SECOND_LINE_SLOT]).toBe(nothing);
    });
  });
});
