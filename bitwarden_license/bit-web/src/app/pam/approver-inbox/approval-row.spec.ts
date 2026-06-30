import { AccessRequestDetailsResponse } from "@bitwarden/bit-pam";

import { ResolvedNames } from "../access-request-name-resolver.service";

import { durationLabel, reasonText, relativeStart, toApprovalRow } from "./approval-row";

function request(
  overrides: Partial<{
    reason: string | null;
    requestedNotBefore: string | null;
    requestedNotAfter: string | null;
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
    RequestedNotBefore: overrides.requestedNotBefore ?? null,
    RequestedNotAfter: overrides.requestedNotAfter ?? null,
    Reason: overrides.reason ?? null,
    SubmittedAt: overrides.submittedAt ?? "2026-06-10T10:00:00Z",
    RequesterName: overrides.requesterName ?? "Bob",
    RequesterEmail: overrides.requesterEmail ?? "bob@example.com",
  });
}

/** Resolved-name lookup keyed to the builder's fixed cipher-1 / col-1 ids. */
function names(overrides: { cipherName?: string; collectionName?: string } = {}): ResolvedNames {
  return {
    cipherNameById: new Map([["cipher-1", overrides.cipherName ?? "Prod DB"]]),
    collectionNameById: new Map([["col-1", overrides.collectionName ?? "Production"]]),
    cipherById: new Map(),
  };
}

const noNames: ResolvedNames = {
  cipherNameById: new Map(),
  collectionNameById: new Map(),
  cipherById: new Map(),
};

describe("durationLabel", () => {
  /** A request whose window spans `seconds`, so the derived duration label can be asserted. */
  const window = (seconds: number) =>
    request({
      requestedNotBefore: "2026-06-10T10:00:00Z",
      requestedNotAfter: new Date(
        Date.parse("2026-06-10T10:00:00Z") + seconds * 1000,
      ).toISOString(),
    });

  it("renders sub-hour durations in minutes (min 1)", () => {
    expect(durationLabel(window(1800))).toEqual({
      key: "pamInboxDurationMinutes",
      value: 30,
    });
    expect(durationLabel(window(10))).toEqual({
      key: "pamInboxDurationMinutes",
      value: 1,
    });
  });

  it("renders exactly one hour with the singular key", () => {
    expect(durationLabel(window(3600))).toEqual({
      key: "pamInboxDuration1Hour",
      value: null,
    });
  });

  it("renders multi-hour durations, rounding fractional hours to one decimal", () => {
    expect(durationLabel(window(4 * 3600))).toEqual({
      key: "pamInboxDurationHours",
      value: 4,
    });
    expect(durationLabel(window(5400))).toEqual({
      key: "pamInboxDurationHours",
      value: 1.5,
    });
  });

  it("returns null when the requested window is open-ended", () => {
    expect(
      durationLabel(request({ requestedNotBefore: null, requestedNotAfter: null })),
    ).toBeNull();
    expect(
      durationLabel(
        request({ requestedNotBefore: null, requestedNotAfter: "2026-06-10T11:00:00Z" }),
      ),
    ).toBeNull();
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
      request({ requesterName: "Bob" }),
      now,
      names({ cipherName: "Prod DB", collectionName: "Production" }),
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
      SubmittedAt: "2026-06-10T10:00:00Z",
      RequesterEmail: "x@example.com",
    });
    const row = toApprovalRow(nameless, now, noNames);
    expect(row.cipherName).toBe("cipher-1");
    expect(row.collectionName).toBeNull();
    expect(row.requester).toBe("x@example.com");
  });
});
