import type { AccessRequestView } from "../abstractions/access-lease";
import { ResolvedNames, emptyResolvedNames } from "../access-requests/access-name-resolver.service";

import { sortApprovalRows, toApprovalRow } from "./approval-row";

const NOW = new Date("2026-08-17T12:00:00.000Z");

function request(overrides: Record<string, unknown> = {}): AccessRequestView {
  return {
    id: "req-1",
    cipherId: "cipher-1",
    collectionId: "col-1",
    requesterId: "user-1",
    status: "pending",
    leaseNotBefore: "2026-08-17T12:00:00.000Z",
    leaseNotAfter: "2026-08-17T13:00:00.000Z",
    reason: "prod incident",
    submittedAt: "2026-08-17T11:30:00.000Z",
    decisions: [],
    requesterName: "Grace",
    requesterEmail: "grace@example.com",
    ...overrides,
  } as unknown as AccessRequestView;
}

function names(overrides: Partial<ResolvedNames> = {}): ResolvedNames {
  return {
    ...emptyResolvedNames(),
    cipherNameById: new Map([["cipher-1", "Prod database"]]),
    collectionNameById: new Map([["col-1", "Production"]]),
    unresolvedCipherName: "Name unavailable",
    ...overrides,
  };
}

describe("toApprovalRow", () => {
  it("resolves the item and collection names from local vault state", () => {
    const row = toApprovalRow(request(), names(), NOW, true);

    expect(row.cipherName).toBe("Prod database");
    expect(row.collectionName).toBe("Production");
  });

  it("falls back to the resolver's placeholder when the item isn't in the caller's vault", () => {
    // An approver often cannot see the item they are granting access to.
    const row = toApprovalRow(request(), names({ cipherNameById: new Map() }), NOW, true);

    expect(row.cipherName).toBe("Name unavailable");
    expect(row.collectionName).toBe("Production");
  });

  it("prefers the requester's name, falling back to their email", () => {
    expect(toApprovalRow(request(), names(), NOW, true).requester).toBe("Grace");
    expect(toApprovalRow(request({ requesterName: undefined }), names(), NOW, true).requester).toBe(
      "grace@example.com",
    );
    expect(
      toApprovalRow(
        request({ requesterName: undefined, requesterEmail: undefined }),
        names(),
        NOW,
        true,
      ).requester,
    ).toBe("");
  });

  it("precomputes the window, reason and elapsed labels", () => {
    const row = toApprovalRow(request(), names(), NOW, true);

    expect(row.duration).toEqual({ key: "pamInboxDuration1Hour", value: null });
    expect(row.relativeStart).toEqual({ key: "pamInboxStartAsap", value: null });
    expect(row.elapsed).toEqual({ key: "pamInboxElapsedMinutes", value: 30 });
    expect(row.reason).toBe("prod incident");
    expect(row.exactWindow).toContain("–");
  });

  it("reports a blank reason as null rather than whitespace", () => {
    expect(toApprovalRow(request({ reason: "   " }), names(), NOW, true).reason).toBeNull();
  });

  it("builds a lowercase search haystack from every name on the row", () => {
    const row = toApprovalRow(request(), names(), NOW, true);

    expect(row.searchText).toBe("prod database production grace grace@example.com");
  });

  it("omits missing names from the haystack rather than adding blanks", () => {
    const row = toApprovalRow(
      request({ requesterName: undefined, requesterEmail: undefined }),
      emptyResolvedNames(),
      NOW,
      true,
    );

    expect(row.searchText).toBe("");
  });

  it("keeps the unresolved placeholder out of the haystack", () => {
    const row = toApprovalRow(
      request({ requesterName: undefined, requesterEmail: undefined }),
      names({ cipherNameById: new Map() }),
      NOW,
      true,
    );

    expect(row.cipherName).toBe("Name unavailable");
    expect(row.searchText).not.toContain("name");
    expect(row.searchText).not.toContain("unavailable");
  });

  it("carries `canDecide` through from the caller", () => {
    expect(toApprovalRow(request(), names(), NOW, false).canDecide).toBe(false);
    expect(toApprovalRow(request(), names(), NOW, true).canDecide).toBe(true);
  });

  it("keeps the whole request so the decide dialog needs no second lookup", () => {
    const source = request();

    expect(toApprovalRow(source, names(), NOW, true).request).toBe(source);
  });
});

describe("sortApprovalRows", () => {
  it("puts the longest-waiting request first", () => {
    const rows = [
      toApprovalRow(
        request({ id: "new", submittedAt: "2026-08-17T11:50:00.000Z" }),
        names(),
        NOW,
        true,
      ),
      toApprovalRow(
        request({ id: "old", submittedAt: "2026-08-17T09:00:00.000Z" }),
        names(),
        NOW,
        true,
      ),
    ];

    expect(sortApprovalRows(rows).map((row) => row.id)).toEqual(["old", "new"]);
  });

  it("breaks ties on collection name so the order does not depend on the server's", () => {
    const submittedAt = "2026-08-17T11:00:00.000Z";
    const rows = [
      toApprovalRow(
        request({ id: "b", submittedAt, collectionId: "col-b" }),
        names({ collectionNameById: new Map([["col-b", "Staging"]]) }),
        NOW,
        true,
      ),
      toApprovalRow(
        request({ id: "a", submittedAt, collectionId: "col-a" }),
        names({ collectionNameById: new Map([["col-a", "Production"]]) }),
        NOW,
        true,
      ),
    ];

    expect(sortApprovalRows(rows).map((row) => row.id)).toEqual(["a", "b"]);
  });

  it("does not mutate the input", () => {
    const rows = [
      toApprovalRow(
        request({ id: "new", submittedAt: "2026-08-17T11:50:00.000Z" }),
        names(),
        NOW,
        true,
      ),
      toApprovalRow(
        request({ id: "old", submittedAt: "2026-08-17T09:00:00.000Z" }),
        names(),
        NOW,
        true,
      ),
    ];

    sortApprovalRows(rows);

    expect(rows.map((row) => row.id)).toEqual(["new", "old"]);
  });
});
