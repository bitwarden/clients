import { ThemeTypes } from "@bitwarden/common/platform/enums";

import { EventSecurity } from "../../../utils/event-security";

import { ActionButton } from "./action-button";

// FIXME: These tests should be rewritten to render to the DOM once the test configuration
// is updated to process Lit's ESM module definitions.
jest.mock("lit", () => ({
  html: jest.fn((_strings: TemplateStringsArray, ...values: any[]) => values),
}));
jest.mock("@emotion/css", () => ({ css: jest.fn(() => "") }));
jest.mock("../icons", () => ({ Spinner: jest.fn() }));
jest.mock("../constants/styles", () => ({
  border: { radius: { full: "9999px" } },
  themes: {
    light: {
      primary: { 600: "", 700: "" },
      secondary: { 300: "" },
      text: { muted: "", contrast: "" },
    },
  },
  typography: { body2: "" },
  spacing: { 1: "", 3: "" },
}));

describe("ActionButton", () => {
  const baseProps = {
    buttonText: "Save",
    theme: ThemeTypes.Light,
    handleClick: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("title attribute", () => {
    // Template slot layout (positions in the html mock's values array):
    // [0] class (actionButtonStyles), [1] data-testid, [2] title (title ?? buttonText),
    // [3] @click handler, [4] content (Spinner | buttonText)
    const TITLE_SLOT = 2;

    it("uses the title prop when provided", () => {
      const values = ActionButton({ ...baseProps, title: "Custom title" }) as unknown as any[];

      expect(values[TITLE_SLOT]).toBe("Custom title");
    });

    it("falls back to buttonText when title prop is omitted", () => {
      const values = ActionButton({ ...baseProps, buttonText: "Save" }) as unknown as any[];

      expect(values[TITLE_SLOT]).toBe("Save");
    });
  });

  describe("click handler", () => {
    const CLICK_HANDLER_SLOT = 3;

    it("calls handleClick when the event is trusted and button is active", () => {
      jest.spyOn(EventSecurity, "isEventTrusted").mockReturnValue(true);

      const values = ActionButton(baseProps) as unknown as any[];
      values[CLICK_HANDLER_SLOT](new MouseEvent("click"));

      expect(baseProps.handleClick).toHaveBeenCalled();
    });

    it("does not call handleClick when the event is untrusted", () => {
      jest.spyOn(EventSecurity, "isEventTrusted").mockReturnValue(false);

      const values = ActionButton(baseProps) as unknown as any[];
      values[CLICK_HANDLER_SLOT](new MouseEvent("click"));

      expect(baseProps.handleClick).not.toHaveBeenCalled();
    });

    it("does not call handleClick when disabled", () => {
      jest.spyOn(EventSecurity, "isEventTrusted").mockReturnValue(true);

      const values = ActionButton({ ...baseProps, disabled: true }) as unknown as any[];
      values[CLICK_HANDLER_SLOT](new MouseEvent("click"));

      expect(baseProps.handleClick).not.toHaveBeenCalled();
    });

    it("does not call handleClick when loading", () => {
      jest.spyOn(EventSecurity, "isEventTrusted").mockReturnValue(true);

      const values = ActionButton({ ...baseProps, isLoading: true }) as unknown as any[];
      values[CLICK_HANDLER_SLOT](new MouseEvent("click"));

      expect(baseProps.handleClick).not.toHaveBeenCalled();
    });
  });
});
