import { TabEdgeCause, TabState } from "../enums";
import type { TabEdge } from "../types";

import {
  bufferPageTransition,
  edgeBufferAction,
  reportBufferAction,
  resolvePageTransition,
  retirePageTransition,
} from "./actions";
import { BufferAction } from "./enums";

/**
 * An edge arriving at `to`. The predicates read an edge rather than a state, so a test has to name
 * one; `from` and the cause are set to values the predicate under test does not consult, which is
 * what makes a passing row evidence that it read `to`.
 */
const arrivingAt = (to: TabState, from: TabState = TabState.Frozen): TabEdge => ({
  from,
  to,
  cause: TabEdgeCause.Settle,
  focused: false,
});

/** An edge departing `from`, for the falling-edge predicate. `to` is a value it does not consult. */
const leaving = (from: TabState): TabEdge => arrivingAt(TabState.Hot, from);

describe("edge predicates", () => {
  describe("retirePageTransition", () => {
    // Reads where the edge came from: the states that were not holding a transition retire it. The
    // inverse of `bufferPageTransition`'s set, asked of the other end of the edge.
    const cases: Array<[TabState, boolean]> = [
      [TabState.Frozen, true],
      [TabState.Cold, false],
      [TabState.WarmUp, false],
      [TabState.Warm, true],
      [TabState.Hot, true],
      [TabState.CoolDown, false],
    ];
    it.each(cases)("leaving %s → %s", (from, expected) => {
      expect(retirePageTransition(leaving(from))).toBe(expected);
    });

    it("reads the state left, not the one arrived at", () => {
      expect(retirePageTransition(arrivingAt(TabState.Warm, TabState.Cold))).toBe(false);
      expect(retirePageTransition(arrivingAt(TabState.Cold, TabState.Warm))).toBe(true);
    });
  });

  describe("bufferPageTransition", () => {
    // Cold and warm are deliberately opposite, and the rows sit next to `isMonitoring`'s so the
    // contrast is readable: cold buffers without monitoring, warm monitors without buffering.
    const cases: Array<[TabState, boolean]> = [
      [TabState.Frozen, false],
      [TabState.Cold, true],
      [TabState.WarmUp, true],
      [TabState.Warm, false],
      [TabState.Hot, false],
      [TabState.CoolDown, true],
    ];
    it.each(cases)("arriving at %s → %s", (to, expected) => {
      expect(bufferPageTransition(arrivingAt(to))).toBe(expected);
    });
  });

  describe("resolvePageTransition", () => {
    const cases: Array<[TabState, boolean]> = [
      [TabState.Frozen, false],
      [TabState.Cold, false],
      [TabState.WarmUp, false],
      [TabState.Warm, false],
      [TabState.Hot, true],
      [TabState.CoolDown, false],
    ];
    it.each(cases)("arriving at %s → %s", (to, expected) => {
      expect(resolvePageTransition(arrivingAt(to))).toBe(expected);
    });
  });
});
describe("buffer actions", () => {
  describe("reportBufferAction — a transition reported after the tab's last edge", () => {
    const cases: Array<[TabState | undefined, BufferAction]> = [
      [undefined, BufferAction.Buffer], // no machine edge observed yet
      [TabState.Frozen, BufferAction.Drop],
      [TabState.Cold, BufferAction.Buffer],
      [TabState.WarmUp, BufferAction.Buffer],
      [TabState.Warm, BufferAction.Drop], // background window's active tab is out of scope
      [TabState.Hot, BufferAction.Resolve], // reported while hot resolves at once
      [TabState.CoolDown, BufferAction.Buffer],
    ];
    it.each(cases)("arriving at %s → %s", (to, expected) => {
      expect(reportBufferAction(to === undefined ? undefined : arrivingAt(to))).toBe(expected);
    });
  });

  describe("edgeBufferAction — a transition held across a classified edge", () => {
    const settle = TabEdgeCause.Settle;
    const cases: Array<[string, TabState, TabState, TabEdgeCause, BufferAction]> = [
      // Falling edge retires. Leaving Frozen is the case this rule exists for: a transition
      // reported before the machine classified the tab is kept, and the login edge is what settles
      // it — dropped, because it was reported while no account could have filled it.
      [
        "Frozen → Cold (login)",
        TabState.Frozen,
        TabState.Cold,
        TabEdgeCause.Login,
        BufferAction.Drop,
      ],
      // Leaving Warm or Hot cannot normally hold a transition to retire; these rows pin the rule as
      // total, so no edge sequence can carry one through a state that does not hold it.
      ["Warm → Hot (focus)", TabState.Warm, TabState.Hot, TabEdgeCause.Focus, BufferAction.Drop],
      [
        "Warm → Cold (deactivate)",
        TabState.Warm,
        TabState.Cold,
        TabEdgeCause.Deactivate,
        BufferAction.Drop,
      ],
      [
        "Hot → CoolDown (deactivate)",
        TabState.Hot,
        TabState.CoolDown,
        TabEdgeCause.Deactivate,
        BufferAction.Drop,
      ],
      // Leading edge resolves into Hot from a buffering state.
      ["WarmUp → Hot (settle)", TabState.WarmUp, TabState.Hot, settle, BufferAction.Resolve],
      [
        "CoolDown → Hot (return)",
        TabState.CoolDown,
        TabState.Hot,
        TabEdgeCause.Activate,
        BufferAction.Resolve,
      ],
      // A command-driven hot entry consumes rather than resolves.
      [
        "WarmUp → Hot (command)",
        TabState.WarmUp,
        TabState.Hot,
        TabEdgeCause.Command,
        BufferAction.Drop,
      ],
      // Leading edge into a non-buffering state retires — logout is dominant.
      [
        "Cold → Frozen (logout)",
        TabState.Cold,
        TabState.Frozen,
        TabEdgeCause.Logout,
        BufferAction.Drop,
      ],
      ["WarmUp → Warm (settle bg)", TabState.WarmUp, TabState.Warm, settle, BufferAction.Drop],
      [
        "CoolDown → Warm (return bg)",
        TabState.CoolDown,
        TabState.Warm,
        TabEdgeCause.Activate,
        BufferAction.Drop,
      ],
      // Buffering → buffering keeps waiting; cool-down → cold survives.
      [
        "Cold → WarmUp (activate)",
        TabState.Cold,
        TabState.WarmUp,
        TabEdgeCause.Activate,
        BufferAction.Buffer,
      ],
      [
        "WarmUp → Cold (deactivate)",
        TabState.WarmUp,
        TabState.Cold,
        TabEdgeCause.Deactivate,
        BufferAction.Buffer,
      ],
      [
        "CoolDown → Cold (elapse)",
        TabState.CoolDown,
        TabState.Cold,
        TabEdgeCause.CoolDownElapsed,
        BufferAction.Buffer,
      ],
    ];
    // `focused` is fixed because the action does not read it; the endpoints and the cause decide.
    it.each(cases)("%s", (_name, from, to, cause, expected) => {
      expect(edgeBufferAction({ from, to, cause, focused: false })).toBe(expected);
    });
  });
});
