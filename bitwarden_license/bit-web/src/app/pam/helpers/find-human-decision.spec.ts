import type { AccessRequestDecisionView } from "../abstractions/access-lease";

import { findHumanDecision } from "./find-human-decision";

function decision(overrides: Partial<AccessRequestDecisionView> = {}): AccessRequestDecisionView {
  return {
    deciderKind: "automatic",
    id: undefined,
    name: undefined,
    email: undefined,
    comment: undefined,
    verdict: "approve",
    decidedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  } as unknown as AccessRequestDecisionView;
}

describe("findHumanDecision", () => {
  it("returns undefined when there are no decisions", () => {
    expect(findHumanDecision([])).toBeUndefined();
  });

  it("returns undefined when every decision is automatic", () => {
    expect(findHumanDecision([decision(), decision()])).toBeUndefined();
  });

  it("returns the first human decision", () => {
    const human = decision({ deciderKind: "human", id: "user-1" as never });
    expect(findHumanDecision([decision(), human, decision({ deciderKind: "human" })])).toBe(human);
  });
});
