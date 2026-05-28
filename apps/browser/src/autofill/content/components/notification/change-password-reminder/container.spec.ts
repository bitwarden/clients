import { ThemeTypes } from "@bitwarden/common/platform/enums";

import { mockI18n } from "../../lit-stories/mock-data";

import { ChangePasswordReminderBody } from "./body";
import { ChangePasswordReminderNotification } from "./container";

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
jest.mock("./body", () => ({ ChangePasswordReminderBody: jest.fn() }));
jest.mock("./tip", () => ({ ChangePasswordReminderTip: jest.fn() }));
jest.mock("../../constants/styles", () => ({
  themes: {
    light: {
      secondary: { "300": "#e0e0e0" },
      background: { alt: "#ffffff" },
    },
  },
  spacing: { "4": "16px" },
}));

describe("ChangePasswordReminderNotification", () => {
  const baseProps = {
    handleCloseNotification: jest.fn(),
    i18n: mockI18n,
    notificationTestId: "change-password-reminder-bar",
    theme: ThemeTypes.Light,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("passes the localized reminder description to the body", () => {
    ChangePasswordReminderNotification(baseProps);

    expect(ChangePasswordReminderBody).toHaveBeenCalledWith(
      expect.objectContaining({ message: mockI18n.changePasswordReminderDesc }),
    );
  });

  it("renders the generator tip with i18n strings", () => {
    const { ChangePasswordReminderTip } = jest.requireMock("./tip");

    ChangePasswordReminderNotification(baseProps);

    expect(ChangePasswordReminderTip).toHaveBeenCalledWith(
      expect.objectContaining({ i18n: mockI18n, theme: ThemeTypes.Light }),
    );
  });
});
