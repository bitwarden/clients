import { TabEdgeCause, TabState } from "./enums";
import { transition } from "./machine";
import type { TabLifecycleEvent } from "./types";

const activate = (focused: boolean): TabLifecycleEvent => ({ kind: "activate", focused });
const deactivate: TabLifecycleEvent = { kind: "deactivate" };
const focus: TabLifecycleEvent = { kind: "focus" };
const blur: TabLifecycleEvent = { kind: "blur" };
const command: TabLifecycleEvent = { kind: "command" };
const login: TabLifecycleEvent = { kind: "login" };
const logout: TabLifecycleEvent = { kind: "logout" };

describe("transition (pure)", () => {
  // A context builder; `cause` is immaterial to a transition's outcome, so any member does.
  const ctx = (state: TabState, focused = false) => ({ state, focused, cause: TabEdgeCause.Login });

  // `focused` is asserted alongside the state because it is the field a consumer validates a
  // transition against, and two rows turn on it: `command` reports a focused window it was never
  // told about, and an `activate` for an already-active tab exists only to refresh this axis.
  describe("real transitions land the expected state and focus", () => {
    const cases: Array<[string, ReturnType<typeof ctx>, TabLifecycleEvent, TabState, boolean]> = [
      ["login enters at cold", ctx(TabState.Frozen), login, TabState.Cold, false],
      ["logout from cold", ctx(TabState.Cold), logout, TabState.Frozen, false],
      [
        "logout from warm-up cancels the settle",
        ctx(TabState.WarmUp, true),
        logout,
        TabState.Frozen,
        true,
      ],
      ["logout from warm", ctx(TabState.Warm), logout, TabState.Frozen, false],
      ["logout from hot", ctx(TabState.Hot, true), logout, TabState.Frozen, true],
      ["logout from cool-down", ctx(TabState.CoolDown), logout, TabState.Frozen, false],
      ["activate from cold warms up", ctx(TabState.Cold), activate(true), TabState.WarmUp, true],
      [
        "focused activate from cool-down re-commits hot",
        ctx(TabState.CoolDown),
        activate(true),
        TabState.Hot,
        true,
      ],
      [
        "unfocused activate from cool-down re-commits warm",
        ctx(TabState.CoolDown),
        activate(false),
        TabState.Warm,
        false,
      ],
      [
        "activate on an already-active tab refreshes focus alone",
        ctx(TabState.Warm, false),
        activate(true),
        TabState.Warm,
        true,
      ],
      [
        "deactivate from warm-up drops to cold",
        ctx(TabState.WarmUp, true),
        deactivate,
        TabState.Cold,
        true,
      ],
      ["deactivate from warm drops to cold", ctx(TabState.Warm), deactivate, TabState.Cold, false],
      [
        "deactivate from hot enters cool-down",
        ctx(TabState.Hot, true),
        deactivate,
        TabState.CoolDown,
        true,
      ],
      ["focus promotes warm to hot", ctx(TabState.Warm), focus, TabState.Hot, true],
      ["blur demotes hot to warm", ctx(TabState.Hot, true), blur, TabState.Warm, false],
      [
        // A command carries no focus payload: the machine infers focus from the gesture, so an
        // unfocused warm-up still reports `focused: true` on the hot edge it produces.
        "command early-settles warm-up to hot, asserting focus",
        ctx(TabState.WarmUp, false),
        command,
        TabState.Hot,
        true,
      ],
    ];
    it.each(cases)("%s", (_name, from, event, expectedState, expectedFocused) => {
      const next = transition(from, event);
      expect(next.state).toBe(expectedState);
      expect(next.focused).toBe(expectedFocused);
    });
  });

  describe("no-op events return the same reference (so step re-arms no timer)", () => {
    const cases: Array<[string, ReturnType<typeof ctx>, TabLifecycleEvent]> = [
      ["login while already thawed", ctx(TabState.Cold), login],
      ["logout while already frozen", ctx(TabState.Frozen), logout],
      ["activate while frozen", ctx(TabState.Frozen), activate(true)],
      ["deactivate while cold", ctx(TabState.Cold), deactivate],
      ["deactivate while cool-down", ctx(TabState.CoolDown), deactivate],
      ["focus while cold", ctx(TabState.Cold), focus],
      ["focus while cool-down", ctx(TabState.CoolDown), focus],
      ["blur while cold", ctx(TabState.Cold), blur],
      ["blur while cool-down", ctx(TabState.CoolDown), blur],
      ["command while hot", ctx(TabState.Hot, true), command],
      ["command while cool-down", ctx(TabState.CoolDown), command],
      ["redundant focus while already-focused hot", ctx(TabState.Hot, true), focus],
    ];
    it.each(cases)("%s", (_name, from, event) => {
      expect(transition(from, event)).toBe(from);
    });
  });

  it("a focus mid-warm-up flips the settle destination (a fresh context, not a no-op)", () => {
    const warmingUnfocused = ctx(TabState.WarmUp, false);
    const result = transition(warmingUnfocused, focus);
    expect(result).not.toBe(warmingUnfocused);
    expect(result.state).toBe(TabState.WarmUp);
    expect(result.focused).toBe(true);
  });
});
