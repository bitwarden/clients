import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";

import { WindowMain } from "../window.main";

import { ViewMenu } from "./menu.view";

jest.mock("electron", () => ({}));
jest.mock("../../utils", () => ({ isDev: jest.fn().mockReturnValue(false) }));

describe("ViewMenu", () => {
  const FEATURE_FLAG_OVERRIDES_ID = "featureFlagOverrides";

  const build = (featureFlagOverrideMenuEnabled: boolean) =>
    new ViewMenu(
      mock<I18nService>(),
      mock<MessagingService>(),
      false,
      mock<WindowMain>(),
      featureFlagOverrideMenuEnabled,
    );

  it("offers feature flag overrides when the override menu is enabled", () => {
    const ids = build(true).items.map((item) => item.id);

    expect(ids).toContain(FEATURE_FLAG_OVERRIDES_ID);
  });

  it("hides feature flag overrides when the override menu is disabled", () => {
    const ids = build(false).items.map((item) => item.id);

    expect(ids).not.toContain(FEATURE_FLAG_OVERRIDES_ID);
  });
});
