import type { AccessRequestDecisionView } from "../abstractions/access-lease";

import { findHumanDecision, humanApprover } from "./find-human-decision";

// Overrides use the flat `deciderKind`/`id`/`name`/`email` shorthand and are folded into the SDK's
// nested `decider: "automatic" | { human }` shape here, so the call sites stay terse.
function decision(overrides: Record<string, unknown> = {}): AccessRequestDecisionView {
  const { deciderKind, id, name, email, ...rest } = overrides;
  return {
    decider: deciderKind === "human" ? { human: { id, name, email } } : "automatic",
    comment: undefined,
    verdict: "approve",
    decidedAt: "2024-01-01T00:00:00.000Z",
    ...rest,
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

describe("humanApprover", () => {
  it("returns undefined for an automatic decision", () => {
    expect(humanApprover(decision())).toBeUndefined();
  });

  it("returns the approver for a human decision", () => {
    const approver = humanApprover(
      decision({ deciderKind: "human", name: "Jane Doe", email: "jane@example.com" }),
    );
    expect(approver).toEqual({ id: undefined, name: "Jane Doe", email: "jane@example.com" });
  });
});
