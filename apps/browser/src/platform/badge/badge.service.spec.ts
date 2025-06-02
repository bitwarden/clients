import { mock, MockProxy } from "jest-mock-extended";
import { Subscription } from "rxjs";

import { FakeAccountService, FakeStateProvider } from "@bitwarden/common/spec";

import { BadgeBrowserApi } from "./badge-browser-api";
import { BadgeService } from "./badge.service";
import { DefaultBadgeState } from "./consts";
import { BadgeIcon } from "./icon";
import { BadgeStatePriority } from "./priority";
import { BadgeState, Unset } from "./state";

describe("BadgeService", () => {
  let badgeApi: MockProxy<BadgeBrowserApi>;
  let stateProvider: FakeStateProvider;
  let badgeService!: BadgeService;

  let badgeServiceSubscription: Subscription;

  beforeEach(() => {
    badgeApi = mock<BadgeBrowserApi>();
    stateProvider = new FakeStateProvider(new FakeAccountService({}));
    badgeService = new BadgeService(stateProvider, badgeApi);

    badgeServiceSubscription = badgeService.startListening();
  });

  afterEach(() => {
    badgeServiceSubscription.unsubscribe();
  });

  it("sets provided state when no other state has been set", async () => {
    const state: BadgeState = {
      text: "text",
      backgroundColor: "color",
      icon: BadgeIcon.Locked,
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

  // This relies on the state provider to auto-emit
  it("sets default values on startup", async () => {
    expect(badgeApi.setState).toHaveBeenCalledWith(DefaultBadgeState);
  });

  it("merges states when multiple same-priority states have been set", async () => {
    await badgeService.setState("state-1", BadgeStatePriority.Default, { text: "text" });
    await badgeService.setState("state-2", BadgeStatePriority.Default, {
      backgroundColor: "#fff",
    });
    await badgeService.setState("state-3", BadgeStatePriority.Default, {
      icon: BadgeIcon.Locked,
    });

    expect(badgeApi.setState).toHaveBeenNthCalledWith(2, {
      text: "text",
      backgroundColor: DefaultBadgeState.backgroundColor,
      icon: DefaultBadgeState.icon,
    } satisfies BadgeState);
    expect(badgeApi.setState).toHaveBeenNthCalledWith(3, {
      text: "text",
      backgroundColor: "#fff",
      icon: DefaultBadgeState.icon,
    } satisfies BadgeState);
    expect(badgeApi.setState).toHaveBeenNthCalledWith(4, {
      text: "text",
      backgroundColor: "#fff",
      icon: BadgeIcon.Locked,
    } satisfies BadgeState);
  });

  it("overrides previous lower-priority state when higher-priority state is set", async () => {
    await badgeService.setState("state-1", BadgeStatePriority.Low, {
      text: "text",
      backgroundColor: "#fff",
      icon: BadgeIcon.Locked,
    });
    await badgeService.setState("state-2", BadgeStatePriority.Default, {
      text: "override",
    });
    await badgeService.setState("state-3", BadgeStatePriority.High, { backgroundColor: "#aaa" });

    expect(badgeApi.setState).toHaveBeenNthCalledWith(2, {
      text: "text",
      backgroundColor: "#fff",
      icon: BadgeIcon.Locked,
    } satisfies BadgeState);
    expect(badgeApi.setState).toHaveBeenNthCalledWith(3, {
      text: "override",
      backgroundColor: "#fff",
      icon: BadgeIcon.Locked,
    } satisfies BadgeState);
    expect(badgeApi.setState).toHaveBeenNthCalledWith(4, {
      text: "override",
      backgroundColor: "#aaa",
      icon: BadgeIcon.Locked,
    } satisfies BadgeState);
  });

  it("removes override when a previously high-priority state is cleared", async () => {
    await badgeService.setState("state-1", BadgeStatePriority.Low, {
      text: "text",
      backgroundColor: "#fff",
      icon: BadgeIcon.Locked,
    });
    await badgeService.setState("state-2", BadgeStatePriority.Default, {
      text: "override",
    });
    await badgeService.clearState("state-2");

    expect(badgeApi.setState).toHaveBeenNthCalledWith(2, {
      text: "text",
      backgroundColor: "#fff",
      icon: BadgeIcon.Locked,
    } satisfies BadgeState);
    expect(badgeApi.setState).toHaveBeenNthCalledWith(3, {
      text: "override",
      backgroundColor: "#fff",
      icon: BadgeIcon.Locked,
    } satisfies BadgeState);
    expect(badgeApi.setState).toHaveBeenNthCalledWith(4, {
      text: "text",
      backgroundColor: "#fff",
      icon: BadgeIcon.Locked,
    } satisfies BadgeState);
  });

  it("sets default values when all states have been cleared", async () => {
    await badgeService.setState("state-1", BadgeStatePriority.Low, {
      text: "text",
      backgroundColor: "#fff",
      icon: BadgeIcon.Locked,
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

    expect(badgeApi.setState).toHaveBeenNthCalledWith(7, DefaultBadgeState);
  });

  it("sets default value high-priority state contains Unset", async () => {
    await badgeService.setState("state-1", BadgeStatePriority.Low, {
      text: "text",
      backgroundColor: "#fff",
      icon: BadgeIcon.Locked,
    });
    await badgeService.setState("state-3", BadgeStatePriority.High, {
      icon: Unset,
    });

    expect(badgeApi.setState).toHaveBeenNthCalledWith(2, {
      text: "text",
      backgroundColor: "#fff",
      icon: BadgeIcon.Locked,
    } satisfies BadgeState);
    expect(badgeApi.setState).toHaveBeenNthCalledWith(3, {
      text: "text",
      backgroundColor: "#fff",
      icon: DefaultBadgeState.icon,
    } satisfies BadgeState);
  });

  it("ignores medium-priority Unset when high-priority contains a value", async () => {
    await badgeService.setState("state-1", BadgeStatePriority.Low, {
      text: "text",
      backgroundColor: "#fff",
      icon: BadgeIcon.Locked,
    });
    await badgeService.setState("state-3", BadgeStatePriority.Default, {
      icon: Unset,
    });
    await badgeService.setState("state-3", BadgeStatePriority.High, {
      icon: BadgeIcon.Unlocked,
    });

    expect(badgeApi.setState).toHaveBeenNthCalledWith(4, {
      text: "text",
      backgroundColor: "#fff",
      icon: BadgeIcon.Unlocked,
    } satisfies BadgeState);
  });

  describe("given a state with a tabId", () => {
    it("sets provided state when no other state has been set", async () => {
      const state: BadgeState = {
        tabId: 9001,
        text: "text",
        backgroundColor: "color",
        icon: BadgeIcon.Locked,
      };

      await badgeService.setState("state-name", BadgeStatePriority.Default, state);

      expect(badgeApi.setState).toHaveBeenCalledWith(state);
      expect(badgeApi.setState).toHaveBeenCalledWith(DefaultBadgeState);
    });

    it("sets default values when none are provided", async () => {
      // This is a bit of a weird thing to do, but I don't think it's something we need to prohibit
      const state: BadgeState = { tabId: 9001 };

      await badgeService.setState("state-name", BadgeStatePriority.Default, state);

      expect(badgeApi.setState).toHaveBeenCalledWith({ ...DefaultBadgeState, tabId: 9001 });
      expect(badgeApi.setState).toHaveBeenCalledWith(DefaultBadgeState);
    });

    it("does not merge tabId specific state with general states", async () => {
      await badgeService.setState("general-state", BadgeStatePriority.Default, { text: "text" });
      await badgeService.setState("specific-state", BadgeStatePriority.Default, {
        tabId: 9001,
        backgroundColor: "#fff",
      });
      await badgeService.setState("general-state", BadgeStatePriority.Default, {
        icon: BadgeIcon.Locked,
      });

      expect(badgeApi.setState).toHaveBeenNthCalledWith(2, {
        text: "text",
        backgroundColor: DefaultBadgeState.backgroundColor,
        icon: DefaultBadgeState.icon,
      } satisfies BadgeState);
      expect(badgeApi.setState).toHaveBeenNthCalledWith(3, {
        tabId: 9001,
        backgroundColor: "#fff",
      } satisfies BadgeState);
      expect(badgeApi.setState).toHaveBeenNthCalledWith(4, {
        text: "text",
        backgroundColor: DefaultBadgeState.backgroundColor,
        icon: BadgeIcon.Locked,
      } satisfies BadgeState);
    });

    it("merges states when multiple same-priority states with the same tabId have been set", async () => {
      const tabId = 9001;
      await badgeService.setState("state-1", BadgeStatePriority.Default, { tabId, text: "text" });
      await badgeService.setState("state-2", BadgeStatePriority.Default, {
        tabId,
        backgroundColor: "#fff",
      });
      await badgeService.setState("state-3", BadgeStatePriority.Default, {
        tabId,
        icon: BadgeIcon.Locked,
      });

      expect(badgeApi.setState).toHaveBeenNthCalledWith(2, {
        tabId,
        text: "text",
      } satisfies BadgeState);
      expect(badgeApi.setState).toHaveBeenNthCalledWith(3, {
        tabId,
        text: "text",
        backgroundColor: "#fff",
      } satisfies BadgeState);
      expect(badgeApi.setState).toHaveBeenNthCalledWith(4, {
        tabId,
        text: "text",
        backgroundColor: "#fff",
        icon: BadgeIcon.Locked,
      } satisfies BadgeState);
    });

    it("overrides previous lower-priority state when higher-priority state with the same tabId is set", async () => {
      const tabId = 9001;
      await badgeService.setState("state-1", BadgeStatePriority.Low, {
        tabId,
        text: "text",
        backgroundColor: "#fff",
        icon: BadgeIcon.Locked,
      });
      await badgeService.setState("state-2", BadgeStatePriority.Default, {
        tabId,
        text: "override",
      });
      await badgeService.setState("state-3", BadgeStatePriority.High, {
        tabId,
        backgroundColor: "#aaa",
      });

      expect(badgeApi.setState).toHaveBeenNthCalledWith(2, {
        tabId,
        text: "text",
        backgroundColor: "#fff",
        icon: BadgeIcon.Locked,
      } satisfies BadgeState);
      expect(badgeApi.setState).toHaveBeenNthCalledWith(3, {
        tabId,
        text: "override",
        backgroundColor: "#fff",
        icon: BadgeIcon.Locked,
      } satisfies BadgeState);
      expect(badgeApi.setState).toHaveBeenNthCalledWith(4, {
        tabId,
        text: "override",
        backgroundColor: "#aaa",
        icon: BadgeIcon.Locked,
      } satisfies BadgeState);
    });

    it("removes override when a previously high-priority state with the same tabId is cleared", async () => {
      const tabId = 9001;
      await badgeService.setState("state-1", BadgeStatePriority.Low, {
        tabId,
        text: "text",
        backgroundColor: "#fff",
        icon: BadgeIcon.Locked,
      });
      await badgeService.setState("state-2", BadgeStatePriority.Default, {
        tabId,
        text: "override",
      });
      await badgeService.clearState("state-2");

      expect(badgeApi.setState).toHaveBeenNthCalledWith(2, {
        tabId,
        text: "text",
        backgroundColor: "#fff",
        icon: BadgeIcon.Locked,
      } satisfies BadgeState);
      expect(badgeApi.setState).toHaveBeenNthCalledWith(3, {
        tabId,
        text: "override",
        backgroundColor: "#fff",
        icon: BadgeIcon.Locked,
      } satisfies BadgeState);
      expect(badgeApi.setState).toHaveBeenNthCalledWith(4, {
        tabId,
        text: "text",
        backgroundColor: "#fff",
        icon: BadgeIcon.Locked,
      } satisfies BadgeState);
    });

    it("sets empty state when all states with the same tabId have been cleared", async () => {
      const tabId = 9001;
      await badgeService.setState("state-1", BadgeStatePriority.Low, {
        tabId,
        text: "text",
        backgroundColor: "#fff",
        icon: BadgeIcon.Locked,
      });
      await badgeService.setState("state-2", BadgeStatePriority.Default, {
        tabId,
        text: "override",
      });
      await badgeService.setState("state-3", BadgeStatePriority.High, {
        tabId,
        backgroundColor: "#aaa",
      });
      await badgeService.clearState("state-1");
      await badgeService.clearState("state-2");
      await badgeService.clearState("state-3");

      expect(badgeApi.setState).toHaveBeenNthCalledWith(7, { tabId });
    });

    it("sets undefined value when high-priority state contains Unset", async () => {
      const tabId = 9001;
      await badgeService.setState("state-1", BadgeStatePriority.Low, {
        tabId,
        text: "text",
        backgroundColor: "#fff",
        icon: BadgeIcon.Locked,
      });
      await badgeService.setState("state-3", BadgeStatePriority.High, {
        tabId,
        icon: Unset,
      });

      expect(badgeApi.setState).toHaveBeenNthCalledWith(2, {
        tabId,
        text: "text",
        backgroundColor: "#fff",
        icon: BadgeIcon.Locked,
      } satisfies BadgeState);
      expect(badgeApi.setState).toHaveBeenNthCalledWith(3, {
        tabId,
        text: "text",
        backgroundColor: "#fff",
      } satisfies BadgeState);
    });

    it("ignores medium-priority Unset when high-priority contains a value", async () => {
      const tabId = 9001;
      await badgeService.setState("state-1", BadgeStatePriority.Low, {
        tabId,
        text: "text",
        backgroundColor: "#fff",
        icon: BadgeIcon.Locked,
      });
      await badgeService.setState("state-3", BadgeStatePriority.Default, {
        tabId,
        icon: Unset,
      });
      await badgeService.setState("state-3", BadgeStatePriority.High, {
        tabId,
        icon: BadgeIcon.Unlocked,
      });

      expect(badgeApi.setState).toHaveBeenNthCalledWith(4, {
        text: "text",
        backgroundColor: "#fff",
        icon: BadgeIcon.Unlocked,
      } satisfies BadgeState);
    });
  });
});
