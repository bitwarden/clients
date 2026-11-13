import type { AccessRequestView } from "@bitwarden/sdk-internal";

import { PamInputError } from "../shared/pam-input-error";

import {
  foldExtensionRequests,
  listAccessRequestRows,
  parseStatusFilter,
} from "./access-request-list";

function view(overrides: Record<string, unknown>): AccessRequestView {
  return {
    id: "r1",
    cipherId: "c1",
    collectionId: "col",
    status: "approved",
    submittedAt: "2026-03-01T10:00:00Z",
    producedLeaseId: undefined,
    extensionOfLeaseId: undefined,
    ...overrides,
  } as unknown as AccessRequestView;
}

describe("parseStatusFilter", () => {
  it("accepts every status and no filter", () => {
    expect(parseStatusFilter(undefined)).toBeUndefined();
    for (const s of ["pending", "approved", "denied", "canceled", "expired"]) {
      expect(parseStatusFilter(s)).toBe(s);
    }
    expect(parseStatusFilter(" Pending ")).toBe("pending");
  });

  it("points a double-L spelling at the single-L one", () => {
    expect(() => parseStatusFilter("cancelled")).toThrow("one L");
  });

  it("explains that activation is not a status", () => {
    expect(() => parseStatusFilter("activated")).toThrow("Activation is not a status");
    expect(() => parseStatusFilter("active")).toThrow(PamInputError);
  });

  it("refuses anything else", () => {
    expect(() => parseStatusFilter("nope")).toThrow(PamInputError);
  });
});

describe("foldExtensionRequests", () => {
  const parent = view({ id: "p", producedLeaseId: "L1", submittedAt: "2026-03-01T10:00:00Z" });
  const pendingExt = view({
    id: "e1",
    extensionOfLeaseId: "L1",
    status: "pending",
    submittedAt: "2026-03-01T11:00:00Z",
  });
  const doneExt = view({
    id: "e2",
    extensionOfLeaseId: "L1",
    status: "approved",
    submittedAt: "2026-03-01T10:30:00Z",
  });

  it("folds extensions onto their parent, newest first", () => {
    const rows = foldExtensionRequests([doneExt, parent, pendingExt]);

    expect(rows).toHaveLength(1);
    expect(String(rows[0].request.id)).toBe("p");
    expect(rows[0].extensionRequestIds).toEqual(["e1", "e2"]);
    expect(rows[0].extensionPending).toBe(true);
  });

  it("leaves an extension without a parent as its own row", () => {
    const rows = foldExtensionRequests([pendingExt]);

    expect(rows.map((r) => String(r.request.id))).toEqual(["e1"]);
  });

  it("sorts rows newest first", () => {
    const older = view({ id: "a", submittedAt: "2026-01-01T00:00:00Z" });
    const newer = view({ id: "b", submittedAt: "2026-02-01T00:00:00Z" });

    expect(foldExtensionRequests([older, newer]).map((r) => String(r.request.id))).toEqual([
      "b",
      "a",
    ]);
  });
});

describe("listAccessRequestRows", () => {
  it("filters on the parent's own status after folding", () => {
    const parent = view({ id: "p", status: "approved", producedLeaseId: "L1" });
    const ext = view({ id: "e", status: "pending", extensionOfLeaseId: "L1" });

    expect(listAccessRequestRows([parent, ext], "pending")).toHaveLength(0);
    expect(listAccessRequestRows([parent, ext], "approved")).toHaveLength(1);
    expect(listAccessRequestRows([parent, ext], undefined)).toHaveLength(1);
  });
});
