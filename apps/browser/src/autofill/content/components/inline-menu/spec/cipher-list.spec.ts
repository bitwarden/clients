import { ThemeTypes } from "@bitwarden/common/platform/enums";

import { litValues } from "../../lit-stories/lit-values";
import {
  mockCipherListI18n,
  mockI18n,
  mockLoginCiphers,
  mockPasskeysAndPasswords,
  mockTotpCiphers,
} from "../../lit-stories/mock-data";
import { InlineMenuCipherItem } from "../cipher-item";
import { InlineMenuCipherList } from "../cipher-list";

jest.mock("lit", () => jest.requireActual("../../lit-stories/lit-jest-mocks").litMock);
jest.mock("../container", () => ({ InlineMenuContainer: jest.fn(({ children }) => children) }));
jest.mock("../cipher-item", () => ({ InlineMenuCipherItem: jest.fn(() => "cipher-item") }));

describe("InlineMenuCipherList", () => {
  const baseProps = {
    theme: ThemeTypes.Light,
    ...mockCipherListI18n,
    handleFillCipher: jest.fn(),
    handleViewCipher: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("showTotpUsername", () => {
    it("is true when more than one TOTP cipher is present", () => {
      InlineMenuCipherList({ ...baseProps, ciphers: mockTotpCiphers });

      expect(InlineMenuCipherItem).toHaveBeenCalledWith(
        expect.objectContaining({ showTotpUsername: true }),
      );
    });

    it("is false when only one TOTP cipher is present", () => {
      InlineMenuCipherList({ ...baseProps, ciphers: [mockTotpCiphers[0]] });

      expect(InlineMenuCipherItem).toHaveBeenCalledWith(
        expect.objectContaining({ showTotpUsername: false }),
      );
    });
  });

  describe("passkey headings", () => {
    it("renders passkey and password headings when both cipher types are present", () => {
      const values = litValues(
        InlineMenuCipherList({
          ...baseProps,
          ciphers: mockPasskeysAndPasswords,
        }),
      );

      const items = values[1] as unknown[];
      const headingTexts = items
        .filter((item): item is unknown[] => Array.isArray(item))
        .map((item) => item[1]);

      expect(headingTexts).toEqual([mockI18n.passkeys, mockI18n.passwords]);
      expect(
        (InlineMenuCipherItem as jest.Mock).mock.calls.map(([props]) => props.cipher.id),
      ).toEqual(["1", "2", "3"]);
    });

    it("does not render headings when only password ciphers are present", () => {
      const values = litValues(
        InlineMenuCipherList({
          ...baseProps,
          ciphers: mockLoginCiphers,
        }),
      );

      expect(values[1] as unknown[]).toHaveLength(mockLoginCiphers.length);
      expect(InlineMenuCipherItem).toHaveBeenCalledTimes(mockLoginCiphers.length);
    });
  });

  describe("handlers", () => {
    it("wires fill and view handlers to the matching cipher", () => {
      const cipher = mockLoginCiphers[0];
      const event = new MouseEvent("click");

      InlineMenuCipherList({ ...baseProps, ciphers: [cipher] });

      const props = (InlineMenuCipherItem as jest.Mock).mock.calls[0][0];
      props.handleFillCipher(event);
      props.handleViewCipher(event);

      expect(baseProps.handleFillCipher).toHaveBeenCalledWith(cipher, event);
      expect(baseProps.handleViewCipher).toHaveBeenCalledWith(cipher, event);
    });
  });
});
