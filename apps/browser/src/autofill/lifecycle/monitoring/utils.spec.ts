import { TabEdgeCause, TabState } from "../enums";
import type { TabEdge } from "../types";

import { monitoringChange } from "./utils";

const edge = (from: TabState, to: TabState): TabEdge => ({
  from,
  to,
  cause: TabEdgeCause.Settle,
  focused: false,
});

describe("monitoringChange", () => {
  // Each row is a row of the "Triggers" table in `lifecycle/design.md`, or a move that table leaves
  // without a command because the tab monitors on both sides of it.
  it.each([
    ["warm-up settles to warm", TabState.WarmUp, TabState.Warm],
    ["warm-up settles to hot", TabState.WarmUp, TabState.Hot],
  ])("starts the tab when %s", (_, from, to) => {
    expect(monitoringChange(edge(from, to))).toBe("start");
  });

  it.each([
    ["cool-down elapses", TabState.CoolDown, TabState.Cold],
    ["a warm tab is deactivated", TabState.Warm, TabState.Cold],
    ["a hot tab logs out", TabState.Hot, TabState.Frozen],
    ["a warm tab logs out", TabState.Warm, TabState.Frozen],
    ["a cooling-down tab logs out", TabState.CoolDown, TabState.Frozen],
  ])("stops the tab when %s", (_, from, to) => {
    expect(monitoringChange(edge(from, to))).toBe("stop");
  });

  it.each([
    ["warm gains focus", TabState.Warm, TabState.Hot],
    ["hot loses focus", TabState.Hot, TabState.Warm],
    ["hot is deactivated", TabState.Hot, TabState.CoolDown],
    ["the user returns during cool-down, focused", TabState.CoolDown, TabState.Hot],
    ["the user returns during cool-down, unfocused", TabState.CoolDown, TabState.Warm],
  ])("sends nothing when %s, because the tab monitors on both sides", (_, from, to) => {
    expect(monitoringChange(edge(from, to))).toBeUndefined();
  });

  it.each([
    ["a cold tab is activated", TabState.Cold, TabState.WarmUp],
    ["warm-up is deactivated", TabState.WarmUp, TabState.Cold],
    ["a frozen tab logs in", TabState.Frozen, TabState.Cold],
    ["a cold tab logs out", TabState.Cold, TabState.Frozen],
    ["a warming tab logs out", TabState.WarmUp, TabState.Frozen],
  ])("sends nothing when %s, because the tab monitors on neither", (_, from, to) => {
    expect(monitoringChange(edge(from, to))).toBeUndefined();
  });
});
