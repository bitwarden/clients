import { nothing } from "lit";

import { ThemeTypes } from "@bitwarden/common/platform/enums";

import { EventSecurity } from "../../../../utils/event-security";
import { litHandler, litValues } from "../../lit-stories/lit-values";
import { mockI18n } from "../../lit-stories/mock-data";
import { InlineMenuPrompt } from "../prompt";

jest.mock("lit", () => jest.requireActual("../../lit-stories/lit-jest-mocks").litMock);
jest.mock("../container", () => ({ InlineMenuContainer: jest.fn(({ children }) => children) }));

describe("InlineMenuPrompt", () => {
  const baseProps = {
    message: mockI18n.noItemsToShow,
    actionText: mockI18n.newLogin,
    i18n: { actionAria: mockI18n.addNewLoginItemAria },
    theme: ThemeTypes.Light,
    handleAction: jest.fn(),
  };

  const MESSAGE_SLOT = 0;
  const CLICK_HANDLER_SLOT = 5;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("message", () => {
    it("renders the message when provided", () => {
      const values = litValues(InlineMenuPrompt(baseProps));

      expect(values[MESSAGE_SLOT]).toContain(mockI18n.noItemsToShow);
    });

    it("renders nothing when message is omitted", () => {
      const values = litValues(InlineMenuPrompt({ ...baseProps, message: undefined }));

      expect(values[MESSAGE_SLOT]).toBe(nothing);
    });
  });

  describe("action click", () => {
    it("calls handleAction when the event is trusted", () => {
      jest.spyOn(EventSecurity, "isEventTrusted").mockReturnValue(true);

      litHandler(
        litValues(InlineMenuPrompt(baseProps)),
        CLICK_HANDLER_SLOT,
      )(new MouseEvent("click"));

      expect(baseProps.handleAction).toHaveBeenCalled();
    });

    it("does not call handleAction when the event is untrusted", () => {
      jest.spyOn(EventSecurity, "isEventTrusted").mockReturnValue(false);

      litHandler(
        litValues(InlineMenuPrompt(baseProps)),
        CLICK_HANDLER_SLOT,
      )(new MouseEvent("click"));

      expect(baseProps.handleAction).not.toHaveBeenCalled();
    });
  });
});
