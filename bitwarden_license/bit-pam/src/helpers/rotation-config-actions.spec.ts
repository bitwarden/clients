import {
  canPause,
  canRecordManual,
  canResume,
  canRotateNow,
  mutationsLocked,
} from "./rotation-config-actions";

// Numeric values per SHARED CONTRACT (mirrored here so the spec does not import
// from abstractions that may not exist in isolation during parallel builds).
const Method = { Automatic: 0, Manual: 1 } as const;
const Status = { Active: 0, Disabled: 1 } as const;

describe("canRotateNow", () => {
  const base = {
    enabled: true,
    targetSystemMethod: Method.Automatic,
    hasActiveJob: false,
  };

  it("returns true when all conditions are met", () => {
    expect(canRotateNow(base, Status.Active)).toBe(true);
  });

  it("returns false when config is disabled", () => {
    expect(canRotateNow({ ...base, enabled: false }, Status.Active)).toBe(false);
  });

  it("returns false when method is Manual", () => {
    expect(canRotateNow({ ...base, targetSystemMethod: Method.Manual }, Status.Active)).toBe(false);
  });

  it("returns false when target status is Disabled", () => {
    expect(canRotateNow(base, Status.Disabled)).toBe(false);
  });

  it("returns false when target status is undefined (not yet loaded)", () => {
    expect(canRotateNow(base, undefined)).toBe(false);
  });

  it("returns false when a job is already active", () => {
    expect(canRotateNow({ ...base, hasActiveJob: true }, Status.Active)).toBe(false);
  });

  it("returns false when disabled AND has an active job", () => {
    expect(canRotateNow({ ...base, enabled: false, hasActiveJob: true }, Status.Active)).toBe(
      false,
    );
  });

  it("returns false when target is disabled AND has active job", () => {
    expect(canRotateNow({ ...base, hasActiveJob: true }, Status.Disabled)).toBe(false);
  });
});

describe("canRecordManual", () => {
  it("returns true for Manual method", () => {
    expect(canRecordManual({ targetSystemMethod: Method.Manual })).toBe(true);
  });

  it("returns false for Automatic method", () => {
    expect(canRecordManual({ targetSystemMethod: Method.Automatic })).toBe(false);
  });
});

describe("mutationsLocked", () => {
  it("returns true when a job is active", () => {
    expect(mutationsLocked({ hasActiveJob: true })).toBe(true);
  });

  it("returns false when no job is active", () => {
    expect(mutationsLocked({ hasActiveJob: false })).toBe(false);
  });
});

describe("canPause", () => {
  it("returns true when config is enabled", () => {
    expect(canPause({ enabled: true })).toBe(true);
  });

  it("returns false when config is already paused (disabled)", () => {
    expect(canPause({ enabled: false })).toBe(false);
  });
});

describe("canResume", () => {
  it("returns true when config is disabled (paused)", () => {
    expect(canResume({ enabled: false })).toBe(true);
  });

  it("returns false when config is already enabled", () => {
    expect(canResume({ enabled: true })).toBe(false);
  });
});
