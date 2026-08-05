import { ThemeTypes } from "@bitwarden/common/platform/enums";

import { EventSecurity } from "../../../../utils/event-security";
import { keyupEvent, litHandler, litValues } from "../../lit-stories/lit-values";
import { mockI18n, mockPasswordGeneratorI18n } from "../../lit-stories/mock-data";
import { InlineMenuPasswordGenerator } from "../password-generator";

jest.mock("lit", () => jest.requireActual("../../lit-stories/lit-jest-mocks").litMock);
jest.mock("../container", () => ({ InlineMenuContainer: jest.fn(({ children }) => children) }));

describe("InlineMenuPasswordGenerator", () => {
  const baseProps = {
    password: "f9#Wx",
    headingText: mockI18n.fillGeneratedPassword,
    theme: ThemeTypes.Light,
    i18n: mockPasswordGeneratorI18n,
    handleFillPassword: jest.fn(),
    handleRefreshPassword: jest.fn(),
  };

  const FILL_CLICK_SLOT = 4;
  const FILL_KEYUP_SLOT = 5;
  const REFRESH_CLICK_SLOT = 14;
  const REFRESH_KEYUP_SLOT = 15;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  /** Builds a `[data-password-generator-actions]` fixture with fill/refresh buttons, matching the real markup. */
  function renderActionsDom() {
    const actions = document.createElement("div");
    actions.setAttribute("data-password-generator-actions", "");
    const fill = document.createElement("button");
    fill.setAttribute("data-fill-generated-password", "");
    const refresh = document.createElement("button");
    refresh.setAttribute("data-refresh-generated-password", "");
    actions.append(fill, refresh);
    fill.focus = jest.fn();
    refresh.focus = jest.fn();
    return { actions, fill, refresh };
  }

  describe("click handlers", () => {
    it("calls handleFillPassword when the event is trusted", () => {
      jest.spyOn(EventSecurity, "isEventTrusted").mockReturnValue(true);

      litHandler(
        litValues(InlineMenuPasswordGenerator(baseProps)),
        FILL_CLICK_SLOT,
      )(new MouseEvent("click"));

      expect(baseProps.handleFillPassword).toHaveBeenCalled();
    });

    it("does not call handleFillPassword when the event is untrusted", () => {
      jest.spyOn(EventSecurity, "isEventTrusted").mockReturnValue(false);

      litHandler(
        litValues(InlineMenuPasswordGenerator(baseProps)),
        FILL_CLICK_SLOT,
      )(new MouseEvent("click"));

      expect(baseProps.handleFillPassword).not.toHaveBeenCalled();
    });

    it("calls handleRefreshPassword when the event is trusted", () => {
      jest.spyOn(EventSecurity, "isEventTrusted").mockReturnValue(true);
      const actions = document.createElement("div");
      actions.setAttribute("data-password-generator-actions", "");
      const button = document.createElement("button");
      actions.appendChild(button);
      const event = new MouseEvent("click", { bubbles: true });
      Object.defineProperty(event, "target", { value: button });

      litHandler(litValues(InlineMenuPasswordGenerator(baseProps)), REFRESH_CLICK_SLOT)(event);

      expect(baseProps.handleRefreshPassword).toHaveBeenCalled();
      expect(actions.classList.contains("remove-outline")).toBe(true);
    });

    it("does not call handleRefreshPassword when the event is untrusted", () => {
      jest.spyOn(EventSecurity, "isEventTrusted").mockReturnValue(false);

      litHandler(
        litValues(InlineMenuPasswordGenerator(baseProps)),
        REFRESH_CLICK_SLOT,
      )(new MouseEvent("click"));

      expect(baseProps.handleRefreshPassword).not.toHaveBeenCalled();
    });
  });

  describe("keyboard navigation", () => {
    it("moves focus to the refresh button on ArrowRight and marks the outline removed", () => {
      jest.spyOn(EventSecurity, "isEventTrusted").mockReturnValue(true);
      const { actions, fill, refresh } = renderActionsDom();

      litHandler(
        litValues(InlineMenuPasswordGenerator(baseProps)),
        FILL_KEYUP_SLOT,
      )(keyupEvent("ArrowRight", fill));

      expect(refresh.focus).toHaveBeenCalled();
      expect(actions.classList.contains("remove-outline")).toBe(true);
    });

    it("does not move focus on ArrowRight when the event is untrusted", () => {
      jest.spyOn(EventSecurity, "isEventTrusted").mockReturnValue(false);
      const { fill, refresh } = renderActionsDom();

      litHandler(
        litValues(InlineMenuPasswordGenerator(baseProps)),
        FILL_KEYUP_SLOT,
      )(keyupEvent("ArrowRight", fill));

      expect(refresh.focus).not.toHaveBeenCalled();
    });

    it("ignores ArrowLeft on the fill button's keyup handler", () => {
      jest.spyOn(EventSecurity, "isEventTrusted").mockReturnValue(true);
      const { fill, refresh } = renderActionsDom();

      litHandler(
        litValues(InlineMenuPasswordGenerator(baseProps)),
        FILL_KEYUP_SLOT,
      )(keyupEvent("ArrowLeft", fill));

      expect(refresh.focus).not.toHaveBeenCalled();
    });

    it("ignores keyup events with modifier keys held", () => {
      jest.spyOn(EventSecurity, "isEventTrusted").mockReturnValue(true);
      const { fill, refresh } = renderActionsDom();

      litHandler(
        litValues(InlineMenuPasswordGenerator(baseProps)),
        FILL_KEYUP_SLOT,
      )(keyupEvent("ArrowRight", fill, { ctrlKey: true }));

      expect(refresh.focus).not.toHaveBeenCalled();
    });

    it("moves focus to the fill button on ArrowLeft and clears the outline removal", () => {
      jest.spyOn(EventSecurity, "isEventTrusted").mockReturnValue(true);
      const { actions, fill, refresh } = renderActionsDom();
      actions.classList.add("remove-outline");

      litHandler(
        litValues(InlineMenuPasswordGenerator(baseProps)),
        REFRESH_KEYUP_SLOT,
      )(keyupEvent("ArrowLeft", refresh));

      expect(fill.focus).toHaveBeenCalled();
      expect(actions.classList.contains("remove-outline")).toBe(false);
    });

    it("ignores ArrowRight on the refresh button's keyup handler", () => {
      jest.spyOn(EventSecurity, "isEventTrusted").mockReturnValue(true);
      const { fill, refresh } = renderActionsDom();

      litHandler(
        litValues(InlineMenuPasswordGenerator(baseProps)),
        REFRESH_KEYUP_SLOT,
      )(keyupEvent("ArrowRight", refresh));

      expect(fill.focus).not.toHaveBeenCalled();
    });
  });
});
