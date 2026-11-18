import {
  isPamUnreachableError,
  pamFailureMessageKey,
  PamUnreachableError,
} from "./pam-unreachable-error";

describe("pamFailureMessageKey", () => {
  it("gives the connectivity copy for a call that never reached the server", () => {
    expect(pamFailureMessageKey(new PamUnreachableError("timeout"), "pamStartLeaseError")).toBe(
      "pamServerUnreachable",
    );
    expect(pamFailureMessageKey(new PamUnreachableError("network"), "errorOccurred")).toBe(
      "pamServerUnreachable",
    );
  });

  it("keeps the caller's own key for anything else, including a server refusal", () => {
    expect(
      pamFailureMessageKey(
        new Error('Received error message from server: [409] {"message":"No."}'),
        "pamInboxDecisionNoLongerPending",
      ),
    ).toBe("pamInboxDecisionNoLongerPending");
    expect(pamFailureMessageKey("boom", "errorOccurred")).toBe("errorOccurred");
  });
});

describe("PamUnreachableError", () => {
  it("is recognised, and keeps the error it stands in for", () => {
    const original = new Error("error sending request");
    const error = new PamUnreachableError("network", original);

    expect(isPamUnreachableError(error)).toBe(true);
    expect(error.reason).toBe("network");
    expect(error.original).toBe(original);
    expect(isPamUnreachableError(original)).toBe(false);
  });
});
