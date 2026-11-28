import { nothing } from "lit";

import { ThemeTypes } from "@bitwarden/common/platform/enums";
import { CipherType } from "@bitwarden/common/vault/enums";

import { Passkey } from "../../icons";
import { litValues } from "../../lit-stories/lit-values";
import {
  makeCipher,
  mockCardCiphers,
  mockLoginCiphers,
  mockPasskeyCiphers,
} from "../../lit-stories/mock-data";
import { CipherDetails } from "../cipher-details";

jest.mock("lit", () => jest.requireActual("../../lit-stories/lit-jest-mocks").litMock);
jest.mock("../../icons", () => ({
  ...jest.requireActual("../../icons"),
  BwiIcon: jest.fn(({ name }) => name),
  Passkey: jest.fn(() => "legacy-passkey"),
}));

describe("CipherDetails", () => {
  const SUBTITLE_SLOT = 1;
  const PASSKEY_SECOND_LINE_SLOT = 2;

  beforeEach(() => {
    jest.clearAllMocks();
  });

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

  it("shows the organization icon beside the name when the cipher is org owned", () => {
    const cipher = makeCipher({
      id: "org",
      name: "Gmail",
      type: CipherType.Login,
      organizationId: "org-1",
      login: { username: "dfinnegan@acme.com", passkey: null },
    });
    const values = litValues(
      CipherDetails({
        theme: ThemeTypes.Light,
        cipher,
        designSystem: true,
      }),
    ).flat(Infinity);

    expect(values).toContain("Gmail");
    expect(values).toContain("dfinnegan@acme.com");
    expect(values).toContain("bwi-business");
  });

  it("hides the organization icon when the design-system flag is off", () => {
    const cipher = makeCipher({
      id: "org",
      name: "Gmail",
      type: CipherType.Login,
      organizationId: "org-1",
      login: { username: "dfinnegan@acme.com", passkey: null },
    });
    const values = litValues(
      CipherDetails({
        theme: ThemeTypes.Light,
        cipher,
      }),
    ).flat(Infinity);

    expect(values).not.toContain("bwi-business");
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

    it("places bwi-passkey beside the name and omits the org name on the design-system path", () => {
      const cipher = mockPasskeyCiphers[0];
      const values = litValues(
        CipherDetails({
          theme: ThemeTypes.Light,
          cipher,
          designSystem: true,
          passkeyText: "Passkey",
        }),
      ).flat(Infinity);

      expect(values).toContain(cipher.name);
      expect(values).toContain(cipher.login!.username);
      expect(values).toContain("bwi-passkey");
      expect(values).toContain("Passkey");
      expect(values).not.toContain(cipher.login!.passkey!.rpName);
      expect(Passkey).not.toHaveBeenCalled();
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
