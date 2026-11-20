import { nothing } from "lit";

import { ThemeTypes } from "@bitwarden/common/platform/enums";

import { litValues } from "../../lit-stories/lit-values";
import { mockI18n } from "../../lit-stories/mock-data";
import { InlineMenuAction } from "../action";
import { InlineMenuPrompt } from "../prompt";

jest.mock("lit", () => jest.requireActual("../../lit-stories/lit-jest-mocks").litMock);
jest.mock("../container", () => ({ InlineMenuContainer: jest.fn(({ children }) => children) }));
jest.mock("../action", () => ({ InlineMenuAction: jest.fn(() => "action") }));

describe("InlineMenuPrompt", () => {
  const baseProps = {
    message: mockI18n.noItemsToShow,
    actionText: mockI18n.newLogin,
    i18n: { actionAria: mockI18n.addNewLoginItemAria },
    theme: ThemeTypes.Light,
    handleAction: jest.fn(),
  };

  const MESSAGE_SLOT = 0;

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

  describe("action", () => {
    it("renders the action with a top border when a message is provided", () => {
      InlineMenuPrompt(baseProps);

      expect(InlineMenuAction).toHaveBeenCalledWith(
        expect.objectContaining({
          actionText: mockI18n.newLogin,
          borderedTop: true,
          handleAction: baseProps.handleAction,
        }),
      );
    });

    it("renders the action without a top border when the message is omitted", () => {
      InlineMenuPrompt({ ...baseProps, message: undefined });

      expect(InlineMenuAction).toHaveBeenCalledWith(
        expect.objectContaining({
          borderedTop: false,
        }),
      );
    });
  });
});
