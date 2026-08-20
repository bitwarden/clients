import { ThemeTypes } from "@bitwarden/common/platform/enums";
import { CipherRepromptType } from "@bitwarden/common/vault/enums/cipher-reprompt-type";

import { EventSecurity } from "../../../../utils/event-security";
import { keyupEvent, litHandler, litValues } from "../../lit-stories/lit-values";
import {
  mockCardCiphers,
  mockCipherListI18n,
  mockI18n,
  mockLoginCiphers,
  mockPasskeyCiphers,
  mockTotpCiphers,
} from "../../lit-stories/mock-data";
import { CipherDetails } from "../cipher-details";
import { InlineMenuCipherItem } from "../cipher-item";
import { TotpCipherInfo } from "../totp-cipher-info";
import { TotpCountdown } from "../totp-countdown";

jest.mock("lit", () => jest.requireActual("../../lit-stories/lit-jest-mocks").litMock);
jest.mock("../../cipher/cipher-icon", () => ({ CipherIcon: jest.fn(() => "cipher-icon") }));
jest.mock("../cipher-details", () => ({ CipherDetails: jest.fn(() => "cipher-details") }));
jest.mock("../totp-cipher-info", () => ({ TotpCipherInfo: jest.fn(() => "totp-cipher-info") }));
jest.mock("../totp-countdown", () => ({ TotpCountdown: jest.fn(() => "totp-countdown") }));

describe("InlineMenuCipherItem", () => {
  const baseProps = {
    theme: ThemeTypes.Light,
    ...mockCipherListI18n,
    handleFillCipher: jest.fn(),
    handleViewCipher: jest.fn(),
  };

  const FILL_ARIA_LABEL_SLOT = 4;
  const FILL_ARIA_DESCRIPTION_SLOT = 5;
  const FILL_CLICK_SLOT = 6;
  const FILL_KEYUP_SLOT = 7;
  const ICON_SLOT = 8;
  const DETAILS_SLOT = 9;
  const VIEW_CLICK_SLOT = 13;
  const VIEW_KEYUP_SLOT = 14;

  function renderCipherItemDom(count: number) {
    const list = document.createElement("div");
    const items = Array.from({ length: count }, () => {
      const item = document.createElement("div");
      item.setAttribute("data-cipher-item", "");
      const content = document.createElement("div");
      content.setAttribute("data-cipher-content", "");
      const fill = document.createElement("button");
      fill.setAttribute("data-fill-cipher", "");
      const view = document.createElement("button");
      view.setAttribute("data-view-cipher", "");
      content.append(fill, view);
      item.append(content);
      return { item, content, fill, view };
    });
    list.append(...items.map(({ item }) => item));
    return { list, items };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("login cipher", () => {
    const cipher = mockLoginCiphers[0];

    it("renders cipher icon and details", () => {
      const values = litValues(InlineMenuCipherItem({ ...baseProps, cipher }));

      expect(values[ICON_SLOT]).toBe("cipher-icon");
      expect(values[DETAILS_SLOT]).toBe("cipher-details");
      expect(CipherDetails).toHaveBeenCalledWith({ theme: ThemeTypes.Light, cipher });
      expect(TotpCountdown).not.toHaveBeenCalled();
    });

    it("sets fill aria label and username description", () => {
      const values = litValues(InlineMenuCipherItem({ ...baseProps, cipher }));

      expect(values[FILL_ARIA_LABEL_SLOT]).toBe(`${mockI18n.fillCredentialsFor} ${cipher.name}`);
      expect(values[FILL_ARIA_DESCRIPTION_SLOT]).toBe(
        `${mockI18n.username.toLowerCase()}: ${cipher.login!.username}`,
      );
    });
  });

  describe("totp cipher", () => {
    const cipher = mockTotpCiphers[0];

    it("renders totp countdown and info", () => {
      const values = litValues(
        InlineMenuCipherItem({
          ...baseProps,
          cipher,
          showTotpUsername: true,
          totpSecondsRemaining: 12,
        }),
      );

      expect(values[ICON_SLOT]).toBe("totp-countdown");
      expect(values[DETAILS_SLOT]).toBe("totp-cipher-info");
      expect(TotpCountdown).toHaveBeenCalledWith(
        expect.objectContaining({ period: 30, secondsRemaining: 12 }),
      );
      expect(TotpCipherInfo).toHaveBeenCalledWith(
        expect.objectContaining({
          totp: cipher.login!.totp,
          username: cipher.login!.username,
          masked: false,
        }),
      );
    });

    it("masks the totp code when the cipher requires reprompt", () => {
      InlineMenuCipherItem({
        ...baseProps,
        cipher: { ...cipher, reprompt: CipherRepromptType.Password },
      });

      expect(TotpCipherInfo).toHaveBeenCalledWith(expect.objectContaining({ masked: true }));
    });
  });

  it("describes card numbers for screen readers", () => {
    const cipher = mockCardCiphers[0];
    const values = litValues(InlineMenuCipherItem({ ...baseProps, cipher }));

    expect(values[FILL_ARIA_DESCRIPTION_SLOT]).toBe(`Visa, ${mockI18n.cardNumberEndsWith} 4242`);
  });

  it("uses the passkey aria label prefix", () => {
    const cipher = mockPasskeyCiphers[0];
    const values = litValues(InlineMenuCipherItem({ ...baseProps, cipher }));

    expect(values[FILL_ARIA_LABEL_SLOT]).toBe(
      `${mockI18n.logInWithPasskeyAriaLabel} ${cipher.name}`,
    );
  });

  describe("click handlers", () => {
    const cipher = mockLoginCiphers[0];

    it("calls handleFillCipher when the fill click is trusted", () => {
      jest.spyOn(EventSecurity, "isEventTrusted").mockReturnValue(true);

      litHandler(
        litValues(InlineMenuCipherItem({ ...baseProps, cipher })),
        FILL_CLICK_SLOT,
      )(new MouseEvent("click"));

      expect(baseProps.handleFillCipher).toHaveBeenCalled();
    });

    it("does not call handleFillCipher when the fill click is untrusted", () => {
      jest.spyOn(EventSecurity, "isEventTrusted").mockReturnValue(false);

      litHandler(
        litValues(InlineMenuCipherItem({ ...baseProps, cipher })),
        FILL_CLICK_SLOT,
      )(new MouseEvent("click"));

      expect(baseProps.handleFillCipher).not.toHaveBeenCalled();
    });

    it("calls handleViewCipher and stops propagation when trusted", () => {
      jest.spyOn(EventSecurity, "isEventTrusted").mockReturnValue(true);
      const event = new MouseEvent("click");
      const stopPropagation = jest.spyOn(event, "stopPropagation");

      litHandler(litValues(InlineMenuCipherItem({ ...baseProps, cipher })), VIEW_CLICK_SLOT)(event);

      expect(stopPropagation).toHaveBeenCalled();
      expect(baseProps.handleViewCipher).toHaveBeenCalled();
    });

    it("does not call handleViewCipher when untrusted", () => {
      jest.spyOn(EventSecurity, "isEventTrusted").mockReturnValue(false);

      litHandler(
        litValues(InlineMenuCipherItem({ ...baseProps, cipher })),
        VIEW_CLICK_SLOT,
      )(new MouseEvent("click"));

      expect(baseProps.handleViewCipher).not.toHaveBeenCalled();
    });
  });

  describe("keyboard navigation", () => {
    const cipher = mockLoginCiphers[0];

    it("ignores untrusted keyup events", () => {
      jest.spyOn(EventSecurity, "isEventTrusted").mockReturnValue(false);
      const { items } = renderCipherItemDom(2);
      items.forEach(({ fill, view }) => {
        fill.focus = jest.fn();
        view.focus = jest.fn();
      });
      const fillKeyUp = litHandler(
        litValues(InlineMenuCipherItem({ ...baseProps, cipher })),
        FILL_KEYUP_SLOT,
      );

      fillKeyUp(keyupEvent("ArrowDown", items[0].fill));

      expect(items[1].fill.focus).not.toHaveBeenCalled();
    });

    it("ignores keys other than ArrowUp/ArrowDown/ArrowRight on the fill button", () => {
      jest.spyOn(EventSecurity, "isEventTrusted").mockReturnValue(true);
      const { items } = renderCipherItemDom(2);
      const preventDefault = jest.fn();
      const fillKeyUp = litHandler(
        litValues(InlineMenuCipherItem({ ...baseProps, cipher })),
        FILL_KEYUP_SLOT,
      );

      fillKeyUp(keyupEvent("Tab", items[0].fill, {}, { preventDefault }));

      expect(preventDefault).not.toHaveBeenCalled();
    });

    it("moves focus to the next item's fill button on ArrowDown", () => {
      jest.spyOn(EventSecurity, "isEventTrusted").mockReturnValue(true);
      const { items } = renderCipherItemDom(3);
      items.forEach(({ fill, view }) => {
        fill.focus = jest.fn();
        view.focus = jest.fn();
      });
      const fillKeyUp = litHandler(
        litValues(InlineMenuCipherItem({ ...baseProps, cipher })),
        FILL_KEYUP_SLOT,
      );

      fillKeyUp(keyupEvent("ArrowDown", items[0].fill));

      expect(items[1].fill.focus).toHaveBeenCalled();
    });

    it("moves focus to the previous item's fill button on ArrowUp", () => {
      jest.spyOn(EventSecurity, "isEventTrusted").mockReturnValue(true);
      const { items } = renderCipherItemDom(3);
      items.forEach(({ fill, view }) => {
        fill.focus = jest.fn();
        view.focus = jest.fn();
      });
      const fillKeyUp = litHandler(
        litValues(InlineMenuCipherItem({ ...baseProps, cipher })),
        FILL_KEYUP_SLOT,
      );

      fillKeyUp(keyupEvent("ArrowUp", items[1].fill));

      expect(items[0].fill.focus).toHaveBeenCalled();
    });

    it("wraps focus to the first fill button on ArrowDown from the last item", () => {
      jest.spyOn(EventSecurity, "isEventTrusted").mockReturnValue(true);
      const { items } = renderCipherItemDom(2);
      items.forEach(({ fill, view }) => {
        fill.focus = jest.fn();
        view.focus = jest.fn();
      });
      const fillKeyUp = litHandler(
        litValues(InlineMenuCipherItem({ ...baseProps, cipher })),
        FILL_KEYUP_SLOT,
      );

      fillKeyUp(keyupEvent("ArrowDown", items[1].fill));

      expect(items[0].fill.focus).toHaveBeenCalled();
    });

    it("wraps focus to the last fill button on ArrowUp from the first item", () => {
      jest.spyOn(EventSecurity, "isEventTrusted").mockReturnValue(true);
      const { items } = renderCipherItemDom(2);
      items.forEach(({ fill, view }) => {
        fill.focus = jest.fn();
        view.focus = jest.fn();
      });
      const fillKeyUp = litHandler(
        litValues(InlineMenuCipherItem({ ...baseProps, cipher })),
        FILL_KEYUP_SLOT,
      );

      fillKeyUp(keyupEvent("ArrowUp", items[0].fill));

      expect(items[1].fill.focus).toHaveBeenCalled();
    });

    it("moves focus to the view button on ArrowRight and marks the outline removed", () => {
      jest.spyOn(EventSecurity, "isEventTrusted").mockReturnValue(true);
      const { items } = renderCipherItemDom(1);
      items[0].view.focus = jest.fn();
      const fillKeyUp = litHandler(
        litValues(InlineMenuCipherItem({ ...baseProps, cipher })),
        FILL_KEYUP_SLOT,
      );

      fillKeyUp(keyupEvent("ArrowRight", items[0].fill));

      expect(items[0].content.classList.contains("remove-outline")).toBe(true);
      expect(items[0].view.focus).toHaveBeenCalled();
    });

    it("moves focus to the fill button on ArrowLeft and clears the outline removal", () => {
      jest.spyOn(EventSecurity, "isEventTrusted").mockReturnValue(true);
      const { items } = renderCipherItemDom(1);
      items[0].content.classList.add("remove-outline");
      items[0].fill.focus = jest.fn();
      const viewKeyUp = litHandler(
        litValues(InlineMenuCipherItem({ ...baseProps, cipher })),
        VIEW_KEYUP_SLOT,
      );

      viewKeyUp(keyupEvent("ArrowLeft", items[0].view));

      expect(items[0].content.classList.contains("remove-outline")).toBe(false);
      expect(items[0].fill.focus).toHaveBeenCalled();
    });

    it("moves focus to the next item's fill button on ArrowDown from the view button", () => {
      jest.spyOn(EventSecurity, "isEventTrusted").mockReturnValue(true);
      const { items } = renderCipherItemDom(2);
      items.forEach(({ fill, view }) => {
        fill.focus = jest.fn();
        view.focus = jest.fn();
      });
      const viewKeyUp = litHandler(
        litValues(InlineMenuCipherItem({ ...baseProps, cipher })),
        VIEW_KEYUP_SLOT,
      );

      viewKeyUp(keyupEvent("ArrowDown", items[0].view));

      expect(items[1].fill.focus).toHaveBeenCalled();
    });

    it("ignores keys other than ArrowUp/ArrowDown/ArrowLeft on the view button", () => {
      jest.spyOn(EventSecurity, "isEventTrusted").mockReturnValue(true);
      const { items } = renderCipherItemDom(1);
      const preventDefault = jest.fn();
      const viewKeyUp = litHandler(
        litValues(InlineMenuCipherItem({ ...baseProps, cipher })),
        VIEW_KEYUP_SLOT,
      );

      viewKeyUp(keyupEvent("Tab", items[0].view, {}, { preventDefault }));

      expect(preventDefault).not.toHaveBeenCalled();
    });

    it("skips non-cipher-item siblings when finding the adjacent item", () => {
      jest.spyOn(EventSecurity, "isEventTrusted").mockReturnValue(true);
      const { list, items } = renderCipherItemDom(2);
      items.forEach(({ fill, view }) => {
        fill.focus = jest.fn();
        view.focus = jest.fn();
      });
      const heading = document.createElement("div");
      list.insertBefore(heading, items[1].item);
      const fillKeyUp = litHandler(
        litValues(InlineMenuCipherItem({ ...baseProps, cipher })),
        FILL_KEYUP_SLOT,
      );

      fillKeyUp(keyupEvent("ArrowDown", items[0].fill));

      expect(items[1].fill.focus).toHaveBeenCalled();
    });
  });
});
