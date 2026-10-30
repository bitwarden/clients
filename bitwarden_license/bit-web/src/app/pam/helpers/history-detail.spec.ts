import type { AccessRequestView } from "../abstractions/access-lease";
import { automaticDecision, humanDecision, selfEndDecision } from "../testing/decision-builders";

import {
  HISTORY_OUTCOME_BADGES,
  historyDateTime,
  historyDecisionSummary,
  historyOutcome,
  historyWindowRange,
} from "./history-detail";

const NOW = Date.parse("2026-10-21T12:00:00.000Z");
const PAST = "2026-10-21T11:00:00.000Z";
const FUTURE = "2026-10-21T13:00:00.000Z";

function request(overrides: Record<string, unknown> = {}): AccessRequestView {
  return {
    id: "req-1",
    requesterId: "requester-1",
    status: "pending",
    leaseNotBefore: "2026-10-21T14:00:00.000Z",
    leaseNotAfter: FUTURE,
    decisions: [],
    ...overrides,
  } as unknown as AccessRequestView;
}

/** A local wall-clock time, so the formatted dates hold in any runner's timezone. */
function local(year: number, month: number, day: number, hour: number, minute = 0): string {
  return new Date(year, month - 1, day, hour, minute).toISOString();
}

/** ICU separates times with narrow or thin no-break spaces, which vary by Node build. */
function plain(text: string): string {
  return text.replace(/[\u202f\u2009\u00a0]/g, " ");
}

describe("historyOutcome", () => {
  it.each(["denied", "canceled", "expired"] as const)(
    "reads a closed request status (%s) straight through",
    (status) => {
      expect(historyOutcome(request({ status }), NOW)).toBe(status);
    },
  );

  it("reads a lease an operator ended as revoked", () => {
    expect(
      historyOutcome(
        request({ status: "approved", producedLeaseId: "l", producedLeaseStatus: "revoked" }),
        NOW,
      ),
    ).toBe("revoked");
  });

  it.each(["expired", "canceled"] as const)(
    "reads a lease that ran out or its holder ended (%s) as a session ended",
    (producedLeaseStatus) => {
      expect(
        historyOutcome(
          request({ status: "approved", producedLeaseId: "l", producedLeaseStatus }),
          NOW,
        ),
      ).toBe("sessionEnded");
    },
  );

  it("reads a grant whose window closed unused as expired before the server restamps it", () => {
    expect(historyOutcome(request({ status: "approved", leaseNotAfter: PAST }), NOW)).toBe(
      "expired",
    );
  });

  it("treats a window ending exactly now as closed", () => {
    expect(
      historyOutcome(
        request({ status: "approved", leaseNotAfter: new Date(NOW).toISOString() }),
        NOW,
      ),
    ).toBe("expired");
  });

  it.each([
    ["a pending request", { status: "pending" }],
    ["a grant still to start", { status: "approved", leaseNotAfter: FUTURE }],
    ["a live lease", { status: "approved", producedLeaseId: "l", producedLeaseStatus: "active" }],
    [
      "a lease the SDK cannot name",
      { status: "approved", producedLeaseId: "l", producedLeaseStatus: "unknown" },
    ],
    ["a status the SDK cannot name", { status: "unknown" }],
  ])("has no closed outcome for %s", (_, overrides) => {
    expect(historyOutcome(request(overrides), NOW)).toBeNull();
  });
});

describe("HISTORY_OUTCOME_BADGES", () => {
  it("marks the outcomes that left the requester without access as danger", () => {
    expect(HISTORY_OUTCOME_BADGES.denied.variant).toBe("danger");
    expect(HISTORY_OUTCOME_BADGES.expired.variant).toBe("danger");
    expect(HISTORY_OUTCOME_BADGES.revoked.variant).toBe("danger");
  });

  it("keeps the requester's own and natural ends subtle", () => {
    expect(HISTORY_OUTCOME_BADGES.canceled.variant).toBe("subtle");
    expect(HISTORY_OUTCOME_BADGES.sessionEnded.variant).toBe("subtle");
  });

  it("gives every outcome the lock icon and its own label", () => {
    const badges = Object.values(HISTORY_OUTCOME_BADGES);
    expect(badges.every((b) => b.icon === "bwi-lock")).toBe(true);
    expect(new Set(badges.map((b) => b.labelKey)).size).toBe(badges.length);
  });
});

describe("historyDecisionSummary", () => {
  it("credits the approver with their name, email and comment", () => {
    const summary = historyDecisionSummary(
      request({
        decisions: [
          humanDecision({
            id: "a",
            name: "derek.finnegan",
            email: "derek.finnegan@acme.com",
            comment: "  Go ahead.  ",
          }),
        ],
      }),
      "sessionEnded",
    );

    expect(summary).toEqual({
      verdictLabelKey: "pamApprovedBy",
      deciderName: "derek.finnegan",
      deciderLabelKey: null,
      email: "derek.finnegan@acme.com",
      comment: "Go ahead.",
    });
  });

  it("credits the denial on a denied request", () => {
    const summary = historyDecisionSummary(
      request({
        decisions: [humanDecision({ id: "a", name: "derek", verdict: "deny", comment: "No." })],
      }),
      "denied",
    );

    expect(summary?.verdictLabelKey).toBe("pamDeniedBy");
    expect(summary?.comment).toBe("No.");
  });

  it("credits an access rule rather than a person, with no email row", () => {
    const summary = historyDecisionSummary(
      request({ decisions: [automaticDecision()] }),
      "sessionEnded",
    );

    expect(summary).toMatchObject({
      deciderName: null,
      deciderLabelKey: "pamResolverAccessRule",
      email: null,
    });
  });

  it("does not repeat the email when it stands in for a missing name", () => {
    const summary = historyDecisionSummary(
      request({ decisions: [humanDecision({ id: "a", email: "derek@acme.com" })] }),
      "sessionEnded",
    );

    expect(summary?.deciderName).toBe("derek@acme.com");
    expect(summary?.email).toBeNull();
  });

  it("names an approver with neither name nor email as unknown", () => {
    const summary = historyDecisionSummary(
      request({ decisions: [humanDecision({ id: "a", name: " ", email: "" })] }),
      "sessionEnded",
    );

    expect(summary?.deciderLabelKey).toBe("pamResolverUnknown");
    expect(summary?.email).toBeNull();
  });

  it("drops a blank comment", () => {
    const summary = historyDecisionSummary(
      request({ decisions: [humanDecision({ id: "a", name: "derek", comment: "   " })] }),
      "sessionEnded",
    );

    expect(summary?.comment).toBeNull();
  });

  it.each(["canceled", "expired"] as const)(
    "is null for a request %s before anyone decided",
    (outcome) => {
      expect(historyDecisionSummary(request(), outcome)).toBeNull();
    },
  );

  it("credits the approval on a grant that expired unused", () => {
    const summary = historyDecisionSummary(
      request({ decisions: [humanDecision({ id: "a", name: "derek" })] }),
      "expired",
    );

    expect(summary?.verdictLabelKey).toBe("pamApprovedBy");
  });

  it("shows a revoked request's withdraw reason under the approver who granted it", () => {
    const summary = historyDecisionSummary(
      request({
        decisions: [
          humanDecision({ id: "a", name: "derek", comment: "Approved." }),
          humanDecision({ id: "b", name: "maria", verdict: "deny", comment: "Scope changed." }),
        ],
      }),
      "revoked",
    );

    expect(summary?.deciderName).toBe("derek");
    expect(summary?.comment).toBe("Scope changed.");
  });

  it("credits the rule, not the revoker, on an auto-approved lease that was revoked", () => {
    const summary = historyDecisionSummary(
      request({
        decisions: [
          automaticDecision(),
          humanDecision({ id: "b", name: "maria", verdict: "deny", comment: "Cut short." }),
        ],
      }),
      "revoked",
    );

    expect(summary?.verdictLabelKey).toBe("pamApprovedBy");
    expect(summary?.deciderLabelKey).toBe("pamResolverAccessRule");
    expect(summary?.comment).toBe("Cut short.");
  });

  it("falls back to the approval's comment when the revoke gave no reason", () => {
    const summary = historyDecisionSummary(
      request({
        decisions: [
          humanDecision({ id: "a", name: "derek", comment: "Approved." }),
          humanDecision({ id: "b", verdict: "deny" }),
        ],
      }),
      "revoked",
    );

    expect(summary?.comment).toBe("Approved.");
  });

  it("never takes the holder's own end-of-lease note as a revoke reason", () => {
    const summary = historyDecisionSummary(
      request({
        decisions: [
          humanDecision({ id: "a", name: "derek" }),
          selfEndDecision("requester-1", "Done early."),
        ],
      }),
      "revoked",
    );

    expect(summary?.comment).toBeNull();
  });

  it("keeps the approval's comment, not the holder's note, on a session they ended", () => {
    const summary = historyDecisionSummary(
      request({
        decisions: [
          humanDecision({ id: "a", name: "derek", comment: "Approved." }),
          selfEndDecision("requester-1", "Done early."),
        ],
      }),
      "sessionEnded",
    );

    expect(summary?.deciderName).toBe("derek");
    expect(summary?.comment).toBe("Approved.");
  });
});

describe("historyWindowRange", () => {
  it("omits the year for a window in the current year", () => {
    const range = plain(
      historyWindowRange(
        request({
          leaseNotBefore: local(2026, 10, 21, 16, 12),
          leaseNotAfter: local(2026, 10, 21, 20, 12),
        }),
        "en-US",
        NOW,
      ),
    );

    expect(range).toContain("Oct 21");
    expect(range).not.toContain("2026");
  });

  it("shows the year for a window from a prior year", () => {
    const range = historyWindowRange(
      request({
        leaseNotBefore: local(2025, 10, 14, 9),
        leaseNotAfter: local(2025, 10, 14, 13),
      }),
      "en-US",
      NOW,
    );

    expect(range).toContain("2025");
  });

  it("shows the year for a window that crosses into the current year", () => {
    const range = historyWindowRange(
      request({
        leaseNotBefore: local(2025, 12, 31, 12),
        leaseNotAfter: local(2026, 1, 1, 12),
      }),
      "en-US",
      Date.parse(local(2026, 1, 2, 12)),
    );

    expect(range).toContain("2025");
    expect(range).toContain("2026");
  });

  it("formats in the given locale", () => {
    const range = historyWindowRange(
      request({
        leaseNotBefore: local(2026, 10, 21, 16, 12),
        leaseNotAfter: local(2026, 10, 21, 20, 12),
      }),
      "de-DE",
      NOW,
    );

    expect(range).toContain("Okt");
  });
});

describe("historyDateTime", () => {
  it("formats a date and time without seconds", () => {
    const text = plain(historyDateTime(local(2026, 10, 21, 16, 12), "en-US"));

    expect(text).toContain("2026");
    expect(text).toMatch(/\d{1,2}:\d{2} [AP]M$/);
  });
});
