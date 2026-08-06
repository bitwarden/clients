import type { AccessApprover, AccessRequestDecisionView } from "../abstractions/access-lease";

import { findHumanDecision } from "./find-human-decision";

function decision(overrides: Partial<AccessRequestDecisionView> = {}): AccessRequestDecisionView {
  return {
    decider: "automatic",
    comment: undefined,
    verdict: "approve",
    decidedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  } as unknown as AccessRequestDecisionView;
}

function humanDecision(approver: Partial<AccessApprover> = {}): AccessRequestDecisionView {
  return decision({
    decider: { human: { id: undefined, name: undefined, email: undefined, ...approver } },
  } as unknown as Partial<AccessRequestDecisionView>);
}

describe("findHumanDecision", () => {
  it("returns undefined when there are no decisions", () => {
    expect(findHumanDecision([])).toBeUndefined();
  });

  it("returns undefined when every decision is automatic", () => {
    expect(findHumanDecision([decision(), decision()])).toBeUndefined();
  });

  it("returns the first human decision", () => {
    const target = humanDecision({ id: "user-1" as never });
    expect(findHumanDecision([decision(), target, humanDecision()])).toBe(target);
  });
});
