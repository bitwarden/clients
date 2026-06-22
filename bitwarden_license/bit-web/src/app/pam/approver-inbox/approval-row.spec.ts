import { AccessRequestDetailsResponse } from "@bitwarden/pam";

import { durationLabel, reasonText, relativeStart, toApprovalRow } from "./approval-row";

function request(
  overrides: Partial<{
    reason: string | null;
    requestedTtlSeconds: number;
    requestedNotBefore: string | null;
    requestedNotAfter: string | null;
    cipherName: string | null;
    collectionName: string | null;
    requesterName: string | null;
    requesterEmail: string | null;
    submittedAt: string;
  }> = {},
): AccessRequestDetailsResponse {
  return new AccessRequestDetailsResponse({
    Id: "req-1",
    CipherId: "cipher-1",
    CollectionId: "col-1",
    RequesterUserId: "user-2",
    Status: "pending",
    RequestedTtlSeconds: overrides.requestedTtlSeconds ?? 3600,
    RequestedNotBefore: overrides.requestedNotBefore ?? null,
    RequestedNotAfter: overrides.requestedNotAfter ?? null,
    Reason: overrides.reason ?? null,
    SubmittedAt: overrides.submittedAt ?? "2026-06-10T10:00:00Z",
    CipherName: overrides.cipherName ?? "Prod DB",
    CollectionName: overrides.collectionName ?? "Production",
    RequesterName: overrides.requesterName ?? "Bob",
    RequesterEmail: overrides.requesterEmail ?? "bob@example.com",
  });
}

describe("durationLabel", () => {
  it("renders sub-hour durations in minutes (min 1)", () => {
    expect(durationLabel(request({ requestedTtlSeconds: 1800 }))).toEqual({
      key: "pamInboxDurationMinutes",
      value: 30,
    });
    expect(durationLabel(request({ requestedTtlSeconds: 10 }))).toEqual({
      key: "pamInboxDurationMinutes",
      value: 1,
    });
  });

  it("renders exactly one hour with the singular key", () => {
    expect(durationLabel(request({ requestedTtlSeconds: 3600 }))).toEqual({
      key: "pamInboxDuration1Hour",
      value: null,
    });
  });

  it("renders multi-hour durations, rounding fractional hours to one decimal", () => {
    expect(durationLabel(request({ requestedTtlSeconds: 4 * 3600 }))).toEqual({
      key: "pamInboxDurationHours",
      value: 4,
    });
    expect(durationLabel(request({ requestedTtlSeconds: 5400 }))).toEqual({
      key: "pamInboxDurationHours",
      value: 1.5,
    });
  });
});

describe("relativeStart", () => {
  const now = new Date("2026-06-10T12:00:00Z");

  it("returns the ASAP key when there is no start time", () => {
    expect(relativeStart(request({ requestedNotBefore: null }), now)).toEqual({
      key: "pamInboxStartAsap",
      value: null,
    });
  });

  it("returns today for a start within the current day", () => {
    expect(relativeStart(request({ requestedNotBefore: "2026-06-10T15:00:00Z" }), now)).toEqual({
      key: "pamInboxStartToday",
      value: null,
    });
  });

  it("returns tomorrow for the next day", () => {
    expect(relativeStart(request({ requestedNotBefore: "2026-06-11T09:00:00Z" }), now)).toEqual({
      key: "pamInboxStartTomorrow",
      value: null,
    });
  });

  it("returns the day count for further-out starts", () => {
    expect(relativeStart(request({ requestedNotBefore: "2026-06-13T09:00:00Z" }), now)).toEqual({
      key: "pamInboxStartInDays",
      value: 3,
    });
  });
});

describe("reasonText", () => {
  it("trims a reason and returns null when blank", () => {
    expect(reasonText(request({ reason: "  needs access  " }))).toBe("needs access");
    expect(reasonText(request({ reason: "   " }))).toBeNull();
    expect(reasonText(request({ reason: null }))).toBeNull();
  });
});

describe("toApprovalRow", () => {
  const now = new Date("2026-06-10T12:00:00Z");

  it("projects literal sort fields and a search haystack", () => {
    const row = toApprovalRow(
      request({ cipherName: "Prod DB", collectionName: "Production", requesterName: "Bob" }),
      now,
    );
    expect(row.cipherName).toBe("Prod DB");
    expect(row.collectionName).toBe("Production");
    expect(row.requester).toBe("Bob");
    expect(row.searchText).toContain("prod db");
    expect(row.searchText).toContain("production");
    expect(row.searchText).toContain("bob");
  });

  it("falls back to the cipher id and email when names are missing", () => {
    const nameless = new AccessRequestDetailsResponse({
      Id: "req-1",
      CipherId: "cipher-1",
      CollectionId: "col-1",
      RequesterUserId: "user-2",
      Status: "pending",
      RequestedTtlSeconds: 3600,
      SubmittedAt: "2026-06-10T10:00:00Z",
      RequesterEmail: "x@example.com",
    });
    const row = toApprovalRow(nameless, now);
    expect(row.cipherName).toBe("cipher-1");
    expect(row.requester).toBe("x@example.com");
  });
});
