import { nothing } from "lit";

import { ThemeTypes } from "@bitwarden/common/platform/enums";

import { mockI18n } from "../../lit-stories/mock-data";

import { AtRiskNotificationBody } from "./body";
import { AtRiskNotification } from "./container";
import { AtRiskNotificationFooter } from "./footer";

// FIXME: These tests should be rewritten to render to the DOM once the test configuration
// is updated to process Lit's ESM module definitions.
jest.mock("lit", () => ({
  html: jest.fn((_strings: TemplateStringsArray, ...values: any[]) => values),
  nothing: Symbol("nothing"),
}));
jest.mock("@emotion/css", () => ({ css: jest.fn(() => "") }));
jest.mock("../header", () => ({
  NotificationHeader: jest.fn(),
  componentClassPrefix: "header",
}));
jest.mock("./body", () => ({ AtRiskNotificationBody: jest.fn() }));
jest.mock("./footer", () => ({ AtRiskNotificationFooter: jest.fn() }));
jest.mock("../../constants/styles", () => ({
  themes: {
    light: {
      secondary: { "300": "#e0e0e0" },
      background: { alt: "#ffffff" },
    },
  },
  spacing: { "4": "16px" },
}));

describe("AtRiskNotification", () => {
  const baseProps = {
    handleCloseNotification: jest.fn(),
    i18n: mockI18n,
    notificationTestId: "at-risk-notification-bar",
    theme: ThemeTypes.Light,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("i18n message selection", () => {
    it("uses atRiskChangePrompt when hasPasswordChangeUri is true", () => {
      AtRiskNotification({
        ...baseProps,
        params: {
          organizationName: "Acme Co.",
          hasPasswordChangeUri: true,
        },
      });

      expect(chrome.i18n.getMessage).toHaveBeenCalledWith("atRiskChangePrompt", "Acme Co.");
    });

    it("uses atRiskNavigatePrompt when hasPasswordChangeUri is false", () => {
      AtRiskNotification({
        ...baseProps,
        params: {
          organizationName: "Acme Co.",
          hasPasswordChangeUri: false,
        },
      });

      expect(chrome.i18n.getMessage).toHaveBeenCalledWith("atRiskNavigatePromptV2", "Acme Co.");
    });
  });

  describe("body rendering", () => {
    it("passes the resolved risk message to AtRiskNotificationBody", () => {
      (chrome.i18n.getMessage as jest.Mock).mockReturnValueOnce("mocked-risk-message");

      AtRiskNotification({
        ...baseProps,
        params: { organizationName: "Acme Co.", hasPasswordChangeUri: false },
      });

      expect(AtRiskNotificationBody).toHaveBeenCalledWith(
        expect.objectContaining({ riskMessage: "mocked-risk-message" }),
      );
    });
  });

  describe("footer rendering", () => {
    // Template slot layout (positions in the html mock's values array):
    // [0] notificationTestId, [1] containerStyles, [2] NotificationHeader,
    // [3] AtRiskNotificationBody, [4] footer conditional (AtRiskNotificationFooter | nothing)
    const FOOTER_SLOT = 4;

    it("renders the footer when handleChangePasswordClick is provided", () => {
      const footerResult = Symbol("footer");
      (AtRiskNotificationFooter as jest.Mock).mockReturnValueOnce(footerResult);
      const handleChangePasswordClick = jest.fn();

      const values = AtRiskNotification({
        ...baseProps,
        handleChangePasswordClick,
        params: {
          organizationName: "Acme Co.",
          hasPasswordChangeUri: true,
        },
      }) as unknown as any[];

      expect(AtRiskNotificationFooter).toHaveBeenCalledWith(
        expect.objectContaining({
          handleChangePasswordClick,
        }),
      );
      expect(values[FOOTER_SLOT]).toBe(footerResult);
    });

    it("renders nothing in the footer slot when handleChangePasswordClick is not provided", () => {
      const values = AtRiskNotification({
        ...baseProps,
        params: { organizationName: "Acme Co.", hasPasswordChangeUri: true },
      }) as unknown as any[];

      expect(AtRiskNotificationFooter).not.toHaveBeenCalled();
      expect(values[FOOTER_SLOT]).toBe(nothing);
    });

    it("renders the footer when handleChangePasswordClick is provided even if hasPasswordChangeUri is false", () => {
      const footerResult = Symbol("footer");
      (AtRiskNotificationFooter as jest.Mock).mockReturnValueOnce(footerResult);
      const handleChangePasswordClick = jest.fn();

      const values = AtRiskNotification({
        ...baseProps,
        handleChangePasswordClick,
        params: {
          organizationName: "Acme Co.",
          hasPasswordChangeUri: false,
        },
      }) as unknown as any[];

      expect(AtRiskNotificationFooter).toHaveBeenCalledWith(
        expect.objectContaining({
          handleChangePasswordClick,
        }),
      );
      expect(values[FOOTER_SLOT]).toBe(footerResult);
    });
  });
});
