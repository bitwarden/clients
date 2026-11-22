import {
  PopupWidthOptions,
  isIncognitoPopoutLocation,
  isPopupLocation,
  parsePopupWidthOption,
} from "./popup-view";

describe("popup view", () => {
  describe("parsePopupWidthOption", () => {
    it("accepts every width option", () => {
      for (const option of Object.keys(PopupWidthOptions)) {
        expect(parsePopupWidthOption(option)).toBe(option);
      }
    });

    it("maps the retired extraWide option to wide", () => {
      expect(parsePopupWidthOption("extraWide")).toBe("wide");
    });

    it("returns null for nothing stored or an unknown option", () => {
      expect(parsePopupWidthOption(null)).toBeNull();
      expect(parsePopupWidthOption("huge")).toBeNull();
      expect(parsePopupWidthOption(480)).toBeNull();
    });
  });

  describe("isPopupLocation", () => {
    it.each([
      ["chrome-extension://id/popup/index.html#/vault", true],
      ["chrome-extension://id/popup/index.html?uilocation=popup#/vault", true],
      ["chrome-extension://id/popup/index.html?uilocation=popout#/vault", false],
      ["chrome-extension://id/popup/index.html?uilocation=sidebar#/vault", false],
    ])("%s -> %s", (href, expected) => {
      expect(isPopupLocation(href)).toBe(expected);
    });
  });

  describe("isIncognitoPopoutLocation", () => {
    it.each([
      ["chrome-extension://id/popup/index.html?uilocation=popout&incognito=true#/fido2", true],
      [
        "chrome-extension://id/popup/index.html?uilocation=popout&singleActionPopout=vault_Fido2Popout_1&incognito=true#/fido2",
        true,
      ],
      ["chrome-extension://id/popup/index.html?uilocation=popout#/fido2", false],
      [
        "chrome-extension://id/popup/index.html?uilocation=popout#/fido2?senderUrl=https%3A%2F%2Fexample.com%3Fincognito%3Dtrue",
        false,
      ],
      ["chrome-extension://id/popup/index.html?uilocation=popout#/fido2?incognito=true", false],
      ["chrome-extension://id/popup/index.html?uilocation=popup&incognito=true#/vault", false],
      ["chrome-extension://id/popup/index.html?incognito=true#/vault", false],
      ["", false],
    ])("%s -> %s", (href, expected) => {
      expect(isIncognitoPopoutLocation(href)).toBe(expected);
    });
  });
});
