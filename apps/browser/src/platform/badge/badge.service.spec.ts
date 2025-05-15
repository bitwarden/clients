import { mock } from "jest-mock-extended";

import { BadgeBrowserApi } from "./badge-browser-api";
import { BadgeService } from "./badge.service";
import { DefaultBadgeState } from "./consts";
import { BadgeStatePriority } from "./priority";
import { BadgeState } from "./state";

jest.mock("./badge-browser-api", () => ({ BadgeBrowserApi: mock<typeof BadgeBrowserApi>() }));

describe("BadgeService", () => {
  let badgeService!: BadgeService;

  beforeEach(() => {
    jest.clearAllMocks();

    badgeService = new BadgeService();
  });

  it("sets provided state when no other state has been set", async () => {
    const state: BadgeState = {
      text: "text",
      backgroundColor: "color",
      icon: "icon",
    };

    await badgeService.setState("state-name", BadgeStatePriority.Default, state);

    expect(BadgeBrowserApi.setState).toHaveBeenCalledWith(state);
  });

  it("sets default values when none are provided", async () => {
    // This is a bit of a weird thing to do, but I don't think it's something we need to prohibit
    const state: BadgeState = {};

    await badgeService.setState("state-name", BadgeStatePriority.Default, state);

    expect(BadgeBrowserApi.setState).toHaveBeenCalledWith(DefaultBadgeState);
  });

  it("merges states when multiple same-priority states have been set", async () => {
    await badgeService.setState("state-1", BadgeStatePriority.Default, { text: "text" });
    await badgeService.setState("state-2", BadgeStatePriority.Default, {
      backgroundColor: "#fff",
    });
    await badgeService.setState("state-3", BadgeStatePriority.Default, {
      icon: "icon",
    });

    expect(BadgeBrowserApi.setState).toHaveBeenNthCalledWith(1, {
      text: "text",
      backgroundColor: DefaultBadgeState.backgroundColor,
      icon: DefaultBadgeState.icon,
    } satisfies BadgeState);
    expect(BadgeBrowserApi.setState).toHaveBeenNthCalledWith(2, {
      text: "text",
      backgroundColor: "#fff",
      icon: DefaultBadgeState.icon,
    } satisfies BadgeState);
    expect(BadgeBrowserApi.setState).toHaveBeenNthCalledWith(3, {
      text: "text",
      backgroundColor: "#fff",
      icon: "icon",
    } satisfies BadgeState);
  });

  it("overrides previous lower-priority state when higher-priority state is set", async () => {
    await badgeService.setState("state-1", BadgeStatePriority.Low, {
      text: "text",
      backgroundColor: "#fff",
      icon: "icon",
    });
    await badgeService.setState("state-2", BadgeStatePriority.Default, {
      text: "override",
    });
    await badgeService.setState("state-3", BadgeStatePriority.High, { backgroundColor: "#aaa" });

    expect(BadgeBrowserApi.setState).toHaveBeenNthCalledWith(1, {
      text: "text",
      backgroundColor: "#fff",
      icon: "icon",
    } satisfies BadgeState);
    expect(BadgeBrowserApi.setState).toHaveBeenNthCalledWith(2, {
      text: "override",
      backgroundColor: "#fff",
      icon: "icon",
    } satisfies BadgeState);
    expect(BadgeBrowserApi.setState).toHaveBeenNthCalledWith(3, {
      text: "override",
      backgroundColor: "#aaa",
      icon: "icon",
    } satisfies BadgeState);
  });
});
