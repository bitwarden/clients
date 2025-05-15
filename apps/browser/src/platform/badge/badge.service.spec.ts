import { mock, MockProxy } from "jest-mock-extended";

import { FakeAccountService, FakeStateProvider } from "@bitwarden/common/spec";

import { BadgeBrowserApi } from "./badge-browser-api";
import { BadgeService } from "./badge.service";
import { DefaultBadgeState } from "./consts";
import { BadgeStatePriority } from "./priority";
import { BadgeState, IconPaths, Unset } from "./state";

describe("BadgeService", () => {
  let badgeApi: MockProxy<BadgeBrowserApi>;
  let stateProvider: FakeStateProvider;
  let badgeService!: BadgeService;

  beforeEach(() => {
    badgeApi = mock<BadgeBrowserApi>();
    stateProvider = new FakeStateProvider(new FakeAccountService({}));
    badgeService = new BadgeService(stateProvider, badgeApi);
  });

  it("sets provided state when no other state has been set", async () => {
    const state: BadgeState = {
      text: "text",
      backgroundColor: "color",
      icon: icon("icon"),
    };

    await badgeService.setState("state-name", BadgeStatePriority.Default, state);

    expect(badgeApi.setState).toHaveBeenCalledWith(state);
  });

  it("sets default values when none are provided", async () => {
    // This is a bit of a weird thing to do, but I don't think it's something we need to prohibit
    const state: BadgeState = {};

    await badgeService.setState("state-name", BadgeStatePriority.Default, state);

    expect(badgeApi.setState).toHaveBeenCalledWith(DefaultBadgeState);
  });

  it("merges states when multiple same-priority states have been set", async () => {
    await badgeService.setState("state-1", BadgeStatePriority.Default, { text: "text" });
    await badgeService.setState("state-2", BadgeStatePriority.Default, {
      backgroundColor: "#fff",
    });
    await badgeService.setState("state-3", BadgeStatePriority.Default, {
      icon: icon("icon"),
    });

    expect(badgeApi.setState).toHaveBeenNthCalledWith(1, {
      text: "text",
      backgroundColor: DefaultBadgeState.backgroundColor,
      icon: DefaultBadgeState.icon,
    } satisfies BadgeState);
    expect(badgeApi.setState).toHaveBeenNthCalledWith(2, {
      text: "text",
      backgroundColor: "#fff",
      icon: DefaultBadgeState.icon,
    } satisfies BadgeState);
    expect(badgeApi.setState).toHaveBeenNthCalledWith(3, {
      text: "text",
      backgroundColor: "#fff",
      icon: icon("icon"),
    } satisfies BadgeState);
  });

  it("overrides previous lower-priority state when higher-priority state is set", async () => {
    await badgeService.setState("state-1", BadgeStatePriority.Low, {
      text: "text",
      backgroundColor: "#fff",
      icon: icon("icon"),
    });
    await badgeService.setState("state-2", BadgeStatePriority.Default, {
      text: "override",
    });
    await badgeService.setState("state-3", BadgeStatePriority.High, { backgroundColor: "#aaa" });

    expect(badgeApi.setState).toHaveBeenNthCalledWith(1, {
      text: "text",
      backgroundColor: "#fff",
      icon: icon("icon"),
    } satisfies BadgeState);
    expect(badgeApi.setState).toHaveBeenNthCalledWith(2, {
      text: "override",
      backgroundColor: "#fff",
      icon: icon("icon"),
    } satisfies BadgeState);
    expect(badgeApi.setState).toHaveBeenNthCalledWith(3, {
      text: "override",
      backgroundColor: "#aaa",
      icon: icon("icon"),
    } satisfies BadgeState);
  });

  it("removes override when a previously high-priority state is cleared", async () => {
    await badgeService.setState("state-1", BadgeStatePriority.Low, {
      text: "text",
      backgroundColor: "#fff",
      icon: icon("icon"),
    });
    await badgeService.setState("state-2", BadgeStatePriority.Default, {
      text: "override",
    });
    await badgeService.clearState("state-2");

    expect(badgeApi.setState).toHaveBeenNthCalledWith(1, {
      text: "text",
      backgroundColor: "#fff",
      icon: icon("icon"),
    } satisfies BadgeState);
    expect(badgeApi.setState).toHaveBeenNthCalledWith(2, {
      text: "override",
      backgroundColor: "#fff",
      icon: icon("icon"),
    } satisfies BadgeState);
    expect(badgeApi.setState).toHaveBeenNthCalledWith(3, {
      text: "text",
      backgroundColor: "#fff",
      icon: icon("icon"),
    } satisfies BadgeState);
  });

  it("sets default values when all states have been cleared", async () => {
    await badgeService.setState("state-1", BadgeStatePriority.Low, {
      text: "text",
      backgroundColor: "#fff",
      icon: icon("icon"),
    });
    await badgeService.setState("state-2", BadgeStatePriority.Default, {
      text: "override",
    });
    await badgeService.setState("state-3", BadgeStatePriority.High, {
      backgroundColor: "#aaa",
    });
    await badgeService.clearState("state-1");
    await badgeService.clearState("state-2");
    await badgeService.clearState("state-3");

    expect(badgeApi.setState).toHaveBeenNthCalledWith(6, DefaultBadgeState);
  });

  it("sets default value high-priority state contains Unset", async () => {
    await badgeService.setState("state-1", BadgeStatePriority.Low, {
      text: "text",
      backgroundColor: "#fff",
      icon: icon("icon"),
    });
    await badgeService.setState("state-3", BadgeStatePriority.High, {
      icon: Unset,
    });

    expect(badgeApi.setState).toHaveBeenNthCalledWith(1, {
      text: "text",
      backgroundColor: "#fff",
      icon: icon("icon"),
    } satisfies BadgeState);
    expect(badgeApi.setState).toHaveBeenNthCalledWith(2, {
      text: "text",
      backgroundColor: "#fff",
      icon: DefaultBadgeState.icon,
    } satisfies BadgeState);
  });

  it("ignores medium-priority Unset when high-priority contains a value", async () => {
    await badgeService.setState("state-1", BadgeStatePriority.Low, {
      text: "text",
      backgroundColor: "#fff",
      icon: icon("icon"),
    });
    await badgeService.setState("state-3", BadgeStatePriority.Default, {
      icon: Unset,
    });
    await badgeService.setState("state-3", BadgeStatePriority.High, {
      icon: icon("override"),
    });

    expect(badgeApi.setState).toHaveBeenNthCalledWith(3, {
      text: "text",
      backgroundColor: "#fff",
      icon: icon("override"),
    } satisfies BadgeState);
  });
});

function icon(path: string): IconPaths {
  return {
    19: path,
    38: path,
  };
}
