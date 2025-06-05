import { mock, MockProxy } from "jest-mock-extended";
import { Subscription } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
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
  let logService!: MockProxy<LogService>;
  let badgeService!: BadgeService;

  let badgeServiceSubscription: Subscription;

  beforeEach(() => {
    badgeApi = mock<BadgeBrowserApi>();
    stateProvider = new FakeStateProvider(new FakeAccountService({}));
    logService = mock<LogService>();

    badgeService = new BadgeService(stateProvider, badgeApi, logService);
  });

  afterEach(() => {
    badgeServiceSubscription?.unsubscribe();
  });

  describe("calling without tabId", () => {
    const tabId = 1;

    describe("given a single tab is open", () => {
      beforeEach(() => {
        badgeApi.getTabs.mockResolvedValue([1]);
        badgeServiceSubscription = badgeService.startListening();
      });

      // This relies on the state provider to auto-emit
      it("sets default values on startup", async () => {
        await expectGeneralSetState(0, [tabId], DefaultBadgeState);
      });

      it("sets provided state when no other state has been set", async () => {
        const state: BadgeState = {
          text: "text",
          backgroundColor: "color",
          icon: BadgeIcon.Locked,
        };

        await badgeService.setState("state-name", BadgeStatePriority.Default, state);

        await expectGeneralSetState(2, [tabId], state);
      });

      it("sets default values when none are provided", async () => {
        // This is a bit of a weird thing to do, but I don't think it's something we need to prohibit
        const state: BadgeState = {};

        await badgeService.setState("state-name", BadgeStatePriority.Default, state);

        await expectGeneralSetState(2, [tabId], DefaultBadgeState);
      });

      it("merges states when multiple same-priority states have been set", async () => {
        await badgeService.setState("state-1", BadgeStatePriority.Default, { text: "text" });
        await badgeService.setState("state-2", BadgeStatePriority.Default, {
          backgroundColor: "#fff",
        });
        await badgeService.setState("state-3", BadgeStatePriority.Default, {
          icon: BadgeIcon.Locked,
        });

        let setStateCalls = 2;
        setStateCalls = await expectGeneralSetState(setStateCalls, [tabId], {
          text: "text",
          backgroundColor: DefaultBadgeState.backgroundColor,
          icon: DefaultBadgeState.icon,
        });
        setStateCalls = await expectGeneralSetState(setStateCalls, [tabId], {
          text: "text",
          backgroundColor: "#fff",
          icon: DefaultBadgeState.icon,
        });
        await expectGeneralSetState(setStateCalls, [tabId], {
          text: "text",
          backgroundColor: "#fff",
          icon: BadgeIcon.Locked,
        });
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
        await badgeService.setState("state-3", BadgeStatePriority.High, {
          backgroundColor: "#aaa",
        });

        let setStateCalls = 2;
        setStateCalls = await expectGeneralSetState(setStateCalls, [tabId], {
          text: "text",
          backgroundColor: "#fff",
          icon: BadgeIcon.Locked,
        });
        setStateCalls = await expectGeneralSetState(setStateCalls, [tabId], {
          text: "override",
          backgroundColor: "#fff",
          icon: BadgeIcon.Locked,
        });
        await expectGeneralSetState(setStateCalls, [tabId], {
          text: "override",
          backgroundColor: "#aaa",
          icon: BadgeIcon.Locked,
        });
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

        let setStateCalls = 2;
        setStateCalls = await expectGeneralSetState(setStateCalls, [tabId], {
          text: "text",
          backgroundColor: "#fff",
          icon: BadgeIcon.Locked,
        });
        setStateCalls = await expectGeneralSetState(setStateCalls, [tabId], {
          text: "override",
          backgroundColor: "#fff",
          icon: BadgeIcon.Locked,
        });
        await expectGeneralSetState(setStateCalls, [tabId], {
          text: "text",
          backgroundColor: "#fff",
          icon: BadgeIcon.Locked,
        });
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

        await expectGeneralSetState(12, [tabId], DefaultBadgeState);
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

        let setStateCalls = 2;
        setStateCalls = await expectGeneralSetState(setStateCalls, [tabId], {
          text: "text",
          backgroundColor: "#fff",
          icon: BadgeIcon.Locked,
        });
        await expectGeneralSetState(setStateCalls, [tabId], {
          text: "text",
          backgroundColor: "#fff",
          icon: DefaultBadgeState.icon,
        });
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

        await expectGeneralSetState(6, [tabId], {
          text: "text",
          backgroundColor: "#fff",
          icon: BadgeIcon.Unlocked,
        });
      });
    });

    describe.only("given multiple tabs are open", () => {
      const tabIds = [1, 2, 3];

      beforeEach(() => {
        badgeApi.getTabs.mockResolvedValue(tabIds);
        badgeServiceSubscription = badgeService.startListening();
      });

      it("sets default values for each tab on startup", async () => {
        await expectGeneralSetState(0, tabIds, DefaultBadgeState);
      });

      it("sets state for each tab when no other state has been set", async () => {
        const state: BadgeState = {
          text: "text",
          backgroundColor: "color",
          icon: BadgeIcon.Locked,
        };

        await badgeService.setState("state-name", BadgeStatePriority.Default, state);

        await expectGeneralSetState(tabIds.length + 1, tabIds, state);
      });
    });
  });

  describe.skip("calling with tabId", () => {
    describe("given a single tab is open", () => {
      const tabId = 1;
      beforeEach(() => {
        badgeApi.getTabs.mockResolvedValue([tabId]);
      });

      it("sets provided state when no other state has been set", async () => {
        const state: BadgeState = {
          text: "text",
          backgroundColor: "color",
          icon: BadgeIcon.Locked,
        };

        await badgeService.setState("state-name", BadgeStatePriority.Default, state, tabId);

        expect(badgeApi.setState).toHaveBeenCalledWith(DefaultBadgeState);
        expect(badgeApi.setState).toHaveBeenCalledWith(state, tabId);
      });

      it("sets empty values when none are provided", async () => {
        // This is a bit of a weird thing to do, but I don't think it's something we need to prohibit
        const state: BadgeState = {};

        await badgeService.setState("state-name", BadgeStatePriority.Default, state, tabId);

        expect(badgeApi.setState).toHaveBeenNthCalledWith(1, DefaultBadgeState);
        expect(badgeApi.setState).toHaveBeenNthCalledWith(2, state, tabId);
      });

      it("merges tabId specific state with general states", async () => {
        await badgeService.setState("general-state", BadgeStatePriority.Default, { text: "text" });
        await badgeService.setState(
          "specific-state",
          BadgeStatePriority.Default,
          {
            backgroundColor: "#fff",
          },
          tabId,
        );
        await badgeService.setState("general-state-2", BadgeStatePriority.Default, {
          icon: BadgeIcon.Locked,
        });

        expect(badgeApi.setState).toHaveBeenNthCalledWith(
          2,
          {
            text: "text",
            backgroundColor: DefaultBadgeState.backgroundColor,
            icon: DefaultBadgeState.icon,
          } satisfies BadgeState,
          tabId,
        );
        expect(badgeApi.setState).toHaveBeenNthCalledWith(
          3,
          {
            text: "text",
            backgroundColor: "#fff",
            icon: DefaultBadgeState.icon,
          } satisfies BadgeState,
          tabId,
        );
        expect(badgeApi.setState).toHaveBeenNthCalledWith(
          4,
          {
            text: "text",
            backgroundColor: DefaultBadgeState.backgroundColor,
            icon: BadgeIcon.Locked,
          } satisfies BadgeState,
          tabId,
        );
      });

      it("merges states when multiple same-priority states with the same tabId have been set", async () => {
        await badgeService.setState("state-1", BadgeStatePriority.Default, { text: "text" }, tabId);
        await badgeService.setState(
          "state-2",
          BadgeStatePriority.Default,
          {
            backgroundColor: "#fff",
          },
          tabId,
        );
        await badgeService.setState(
          "state-3",
          BadgeStatePriority.Default,
          {
            icon: BadgeIcon.Locked,
          },
          tabId,
        );

        expect(badgeApi.setState).toHaveBeenNthCalledWith(
          2,
          {
            text: "text",
          } satisfies BadgeState,
          tabId,
        );
        expect(badgeApi.setState).toHaveBeenNthCalledWith(
          3,
          {
            text: "text",
            backgroundColor: "#fff",
          } satisfies BadgeState,
          tabId,
        );
        expect(badgeApi.setState).toHaveBeenNthCalledWith(
          4,
          {
            text: "text",
            backgroundColor: "#fff",
            icon: BadgeIcon.Locked,
          } satisfies BadgeState,
          tabId,
        );
      });

      it("overrides previous lower-priority state when higher-priority state with the same tabId is set", async () => {
        await badgeService.setState(
          "state-1",
          BadgeStatePriority.Low,
          {
            text: "text",
            backgroundColor: "#fff",
            icon: BadgeIcon.Locked,
          },
          tabId,
        );
        await badgeService.setState(
          "state-2",
          BadgeStatePriority.Default,
          {
            text: "override",
          },
          tabId,
        );
        await badgeService.setState(
          "state-3",
          BadgeStatePriority.High,
          {
            backgroundColor: "#aaa",
          },
          tabId,
        );

        expect(badgeApi.setState).toHaveBeenNthCalledWith(
          2,
          {
            text: "text",
            backgroundColor: "#fff",
            icon: BadgeIcon.Locked,
          } satisfies BadgeState,
          tabId,
        );
        expect(badgeApi.setState).toHaveBeenNthCalledWith(
          3,
          {
            text: "override",
            backgroundColor: "#fff",
            icon: BadgeIcon.Locked,
          } satisfies BadgeState,
          tabId,
        );
        expect(badgeApi.setState).toHaveBeenNthCalledWith(
          4,
          {
            text: "override",
            backgroundColor: "#aaa",
            icon: BadgeIcon.Locked,
          } satisfies BadgeState,
          tabId,
        );
      });

      it("removes override when a previously high-priority state with the same tabId is cleared", async () => {
        await badgeService.setState(
          "state-1",
          BadgeStatePriority.Low,
          {
            text: "text",
            backgroundColor: "#fff",
            icon: BadgeIcon.Locked,
          },
          tabId,
        );
        await badgeService.setState(
          "state-2",
          BadgeStatePriority.Default,
          {
            text: "override",
          },
          tabId,
        );
        await badgeService.clearState("state-2");

        expect(badgeApi.setState).toHaveBeenNthCalledWith(
          2,
          {
            text: "text",
            backgroundColor: "#fff",
            icon: BadgeIcon.Locked,
          } satisfies BadgeState,
          tabId,
        );
        expect(badgeApi.setState).toHaveBeenNthCalledWith(
          3,
          {
            text: "override",
            backgroundColor: "#fff",
            icon: BadgeIcon.Locked,
          } satisfies BadgeState,
          tabId,
        );
        expect(badgeApi.setState).toHaveBeenNthCalledWith(
          4,
          {
            text: "text",
            backgroundColor: "#fff",
            icon: BadgeIcon.Locked,
          } satisfies BadgeState,
          tabId,
        );
      });

      it("sets empty state when all states with the same tabId have been cleared", async () => {
        await badgeService.setState(
          "state-1",
          BadgeStatePriority.Low,
          {
            text: "text",
            backgroundColor: "#fff",
            icon: BadgeIcon.Locked,
          },
          tabId,
        );
        await badgeService.setState(
          "state-2",
          BadgeStatePriority.Default,
          {
            text: "override",
          },
          tabId,
        );
        await badgeService.setState(
          "state-3",
          BadgeStatePriority.High,
          {
            backgroundColor: "#aaa",
          },
          tabId,
        );
        await badgeService.clearState("state-1");
        await badgeService.clearState("state-2");
        await badgeService.clearState("state-3");

        expect(badgeApi.setState).toHaveBeenNthCalledWith(7, {}, tabId);
      });

      it("sets undefined value when high-priority state contains Unset", async () => {
        await badgeService.setState(
          "state-1",
          BadgeStatePriority.Low,
          {
            text: "text",
            backgroundColor: "#fff",
            icon: BadgeIcon.Locked,
          },
          tabId,
        );
        await badgeService.setState(
          "state-3",
          BadgeStatePriority.High,
          {
            icon: Unset,
          },
          tabId,
        );

        expect(badgeApi.setState).toHaveBeenNthCalledWith(
          2,
          {
            text: "text",
            backgroundColor: "#fff",
            icon: BadgeIcon.Locked,
          } satisfies BadgeState,
          tabId,
        );
        expect(badgeApi.setState).toHaveBeenNthCalledWith(
          3,
          {
            text: "text",
            backgroundColor: "#fff",
          } satisfies BadgeState,
          tabId,
        );
      });

      it("ignores medium-priority Unset when high-priority contains a value", async () => {
        await badgeService.setState(
          "state-1",
          BadgeStatePriority.Low,
          {
            text: "text",
            backgroundColor: "#fff",
            icon: BadgeIcon.Locked,
          },
          tabId,
        );
        await badgeService.setState(
          "state-3",
          BadgeStatePriority.Default,
          {
            icon: Unset,
          },
          tabId,
        );
        await badgeService.setState(
          "state-3",
          BadgeStatePriority.High,
          {
            icon: BadgeIcon.Unlocked,
          },
          tabId,
        );

        expect(badgeApi.setState).toHaveBeenNthCalledWith(
          4,
          {
            text: "text",
            backgroundColor: "#fff",
            icon: BadgeIcon.Unlocked,
          } satisfies BadgeState,
          tabId,
        );
      });
    });
  });

  /**
   * Helper function to expect a collection of setState calls.
   * This checks for expected calls after a general state has been set.
   *
   * @param nPreviousCalls The number of setState calls that have been made before this call.
   * @param availableTabIds The tabIds that are available.
   * @param state The state that is expected to be set.
   * @return The number of setState calls that should have been made after this call.
   */
  async function expectGeneralSetState(
    nPreviousCalls: number,
    availableTabIds: number[],
    state: BadgeState,
  ): Promise<number> {
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(badgeApi.setState).toHaveBeenNthCalledWith(++nPreviousCalls, state);
    for (const tabId of availableTabIds) {
      expect(badgeApi.setState).toHaveBeenNthCalledWith(++nPreviousCalls, state, tabId);
    }

    return nPreviousCalls;
  }

  /**
   * Helper function to expect a collection of setState calls.
   * This checks for expected calls after a state has been set for a specific tabId.
   *
   * @param nPreviousCalls The number of setState calls that have been made before this call.
   * @param _availableTabIds The tabIds that are available.
   * @param tabId The tabId for which the state is expected to be set.
   * @param state The state that is expected to be set.
   * @returns The number of setState calls that should have been made after this call.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function expectSpecificSetState(
    nPreviousCalls: number,
    _availableTabIds: number[],
    tabId: number,
    state: BadgeState,
  ): number {
    expect(badgeApi.setState).toHaveBeenCalledWith(state, tabId);

    return nPreviousCalls + 1;
  }
});
