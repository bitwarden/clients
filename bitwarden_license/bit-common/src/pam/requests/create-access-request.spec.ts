import type { AccessPreCheckView } from "@bitwarden/sdk-internal";

import { PamInputError } from "../shared/pam-input-error";

import { parseCreateShape, planCreateRequest } from "./create-access-request";

const NOW = new Date("2026-03-01T12:00:00Z");

function preCheck(
  overrides: Partial<Record<keyof AccessPreCheckView, unknown>> = {},
): AccessPreCheckView {
  return {
    cipherId: "c" as never,
    approvalMode: "automatic",
    hasActiveLease: false,
    defaultDurationSeconds: 3600,
    maxDurationSeconds: 7200,
    canStartLease: true,
    slotFreesAt: undefined,
    ...overrides,
  } as AccessPreCheckView;
}

describe("parseCreateShape", () => {
  it("is none without flags", () => {
    expect(parseCreateShape({})).toEqual({ kind: "none" });
  });

  it("parses a duration", () => {
    expect(parseCreateShape({ duration: "2h" })).toEqual({ kind: "duration", seconds: 7200 });
  });

  it("parses a window", () => {
    expect(
      parseCreateShape({ start: "2026-03-01T09:00:00Z", end: "2026-03-01T10:00:00Z" }),
    ).toEqual({
      kind: "window",
      start: new Date("2026-03-01T09:00:00Z"),
      end: new Date("2026-03-01T10:00:00Z"),
    });
  });

  it.each([
    [{ duration: "1h", start: "2026-03-01T09:00:00Z" }],
    [{ duration: "1h", end: "2026-03-01T09:00:00Z" }],
    [{ start: "2026-03-01T09:00:00Z" }],
    [{ end: "2026-03-01T09:00:00Z" }],
  ])("refuses the mixed or half-given shape %j", (input) => {
    expect(() => parseCreateShape(input)).toThrow(PamInputError);
  });

  it("refuses a bad duration or date", () => {
    expect(() => parseCreateShape({ duration: "soon" })).toThrow(PamInputError);
    expect(() => parseCreateShape({ start: "x", end: "y" })).toThrow(PamInputError);
  });
});

describe("planCreateRequest", () => {
  describe("automatic", () => {
    it("uses the given duration", () => {
      const plan = planCreateRequest(
        { kind: "duration", seconds: 600 },
        undefined,
        preCheck(),
        NOW,
      );

      expect(plan.approvalMode).toBe("automatic");
      expect(plan.request).toEqual({
        durationSeconds: 600,
        start: undefined,
        end: undefined,
        reason: undefined,
      });
      expect(plan.slotBusy).toBe(false);
    });

    it("defaults to the pre-check duration", () => {
      const plan = planCreateRequest({ kind: "none" }, undefined, preCheck(), NOW);

      expect(plan.request.durationSeconds).toBe(3600);
    });

    it("caps the default at the maximum", () => {
      const plan = planCreateRequest(
        { kind: "none" },
        undefined,
        preCheck({ defaultDurationSeconds: 9000, maxDurationSeconds: 7200 }),
        NOW,
      );

      expect(plan.request.durationSeconds).toBe(7200);
    });

    it("refuses an explicit duration above the maximum", () => {
      expect(() =>
        planCreateRequest({ kind: "duration", seconds: 7201 }, undefined, preCheck(), NOW),
      ).toThrow("cannot be longer than 7200 seconds");
    });

    it("refuses a window", () => {
      expect(() =>
        planCreateRequest(
          { kind: "window", start: NOW, end: new Date(NOW.getTime() + 1000) },
          undefined,
          preCheck(),
          NOW,
        ),
      ).toThrow("approved automatically");
    });

    it("passes an optional reason through", () => {
      const plan = planCreateRequest({ kind: "none" }, "because", preCheck(), NOW);

      expect(plan.request.reason).toBe("because");
    });

    it("flags a busy slot without naming anyone", () => {
      const plan = planCreateRequest(
        { kind: "none" },
        undefined,
        preCheck({ canStartLease: false, slotFreesAt: "2026-03-01T13:00:00Z" }),
        NOW,
      );

      expect(plan.slotBusy).toBe(true);
    });
  });

  describe("human", () => {
    const human = preCheck({ approvalMode: "human", maxDurationSeconds: 86400 });
    const window = {
      kind: "window" as const,
      start: new Date("2026-03-02T09:00:00Z"),
      end: new Date("2026-03-02T11:00:00Z"),
    };

    it("builds a window request with a reason", () => {
      const plan = planCreateRequest(window, "need it", human, NOW);

      expect(plan.approvalMode).toBe("human");
      expect(plan.request).toEqual({
        durationSeconds: undefined,
        start: "2026-03-02T09:00:00.000Z",
        end: "2026-03-02T11:00:00.000Z",
        reason: "need it",
      });
    });

    it("requires a reason", () => {
      expect(() => planCreateRequest(window, undefined, human, NOW)).toThrow("reason is required");
    });

    it("refuses a duration or no window", () => {
      expect(() => planCreateRequest({ kind: "duration", seconds: 60 }, "r", human, NOW)).toThrow(
        "human approval",
      );
      expect(() => planCreateRequest({ kind: "none" }, "r", human, NOW)).toThrow(
        "--start and --end",
      );
    });

    it("validates the window locally", () => {
      expect(() =>
        planCreateRequest({ ...window, end: new Date("2026-03-02T08:00:00Z") }, "r", human, NOW),
      ).toThrow("end must be after the start");
      expect(() =>
        planCreateRequest(
          {
            kind: "window",
            start: new Date("2026-02-01T00:00:00Z"),
            end: new Date("2026-02-02T00:00:00Z"),
          },
          "r",
          human,
          NOW,
        ),
      ).toThrow("end must be in the future");
      expect(() =>
        planCreateRequest({ ...window, end: new Date("2026-03-05T09:00:00Z") }, "r", human, NOW),
      ).toThrow("cannot be longer");
    });

    it("never puts the reason in a refusal", () => {
      try {
        planCreateRequest(
          { ...window, end: new Date("2026-03-02T08:00:00Z") },
          "secret-reason",
          human,
          NOW,
        );
      } catch (e) {
        expect((e as Error).message).not.toContain("secret-reason");
      }
    });
  });

  it("refuses when an active lease already exists", () => {
    expect(() =>
      planCreateRequest({ kind: "none" }, undefined, preCheck({ hasActiveLease: true }), NOW),
    ).toThrow("already have active access");
  });

  it("refuses an unknown approval mode", () => {
    expect(() =>
      planCreateRequest({ kind: "none" }, undefined, preCheck({ approvalMode: "unknown" }), NOW),
    ).toThrow("not recognized");
  });
});
