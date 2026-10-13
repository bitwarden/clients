import { ThemeTypes } from "@bitwarden/common/platform/enums";

import { EventSecurity } from "../../../../utils/event-security";
import { litHandler, litValues } from "../../lit-stories/lit-values";
import { mockI18n } from "../../lit-stories/mock-data";
import { InlineMenuAction } from "../action";

jest.mock("lit", () => jest.requireActual("../../lit-stories/lit-jest-mocks").litMock);

describe("InlineMenuAction", () => {
  const baseProps = {
    actionText: mockI18n.newLogin,
    i18n: { actionAria: mockI18n.addNewLoginItemAria },
    theme: ThemeTypes.Light,
    handleAction: jest.fn(),
  };

  const CLICK_HANDLER_SLOT = 4;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("action click", () => {
    it("calls handleAction when the event is trusted", () => {
      jest.spyOn(EventSecurity, "isEventTrusted").mockReturnValue(true);

      litHandler(
        litValues(InlineMenuAction(baseProps)),
        CLICK_HANDLER_SLOT,
      )(new MouseEvent("click"));

      expect(baseProps.handleAction).toHaveBeenCalled();
    });

    it("does not call handleAction when the event is untrusted", () => {
      jest.spyOn(EventSecurity, "isEventTrusted").mockReturnValue(false);

      litHandler(
        litValues(InlineMenuAction(baseProps)),
        CLICK_HANDLER_SLOT,
      )(new MouseEvent("click"));

      expect(baseProps.handleAction).not.toHaveBeenCalled();
    });
  });
});
