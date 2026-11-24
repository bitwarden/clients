import { TabEdgeCause, TabState } from "./enums";
import type { TabEdge } from "./types";
import { isMonitoring } from "./utils";

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

describe("edge predicates", () => {
  // Each predicate is exhaustive over the six states at the end of the edge it reads, one row per
  // state, so a failure names the state that broke instead of reporting `expected true, received
  // false` for an unidentified member of a list.
  describe("isMonitoring", () => {
    const cases: Array<[TabState, boolean]> = [
      [TabState.Frozen, false],
      [TabState.Cold, false],
      [TabState.WarmUp, false],
      [TabState.Warm, true],
      [TabState.Hot, true],
      [TabState.CoolDown, true],
    ];
    it.each(cases)("arriving at %s → %s", (to, expected) => {
      expect(isMonitoring(arrivingAt(to))).toBe(expected);
    });

    it("reads the state arrived at, not the one left", () => {
      expect(isMonitoring(arrivingAt(TabState.Cold, TabState.Hot))).toBe(false);
      expect(isMonitoring(arrivingAt(TabState.Hot, TabState.Cold))).toBe(true);
    });
  });
});
