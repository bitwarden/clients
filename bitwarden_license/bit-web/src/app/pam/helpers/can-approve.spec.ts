import { canApprove } from "./can-approve";

describe("canApprove", () => {
  it("allows deciding somebody else's request", () => {
    expect(canApprove({ requesterId: "other" }, { id: "me" })).toBe(true);
  });

  it("refuses self-approval", () => {
    expect(canApprove({ requesterId: "me" }, { id: "me" })).toBe(false);
  });

  it("compares ids exactly, so a differently-cased id is a different user", () => {
    // Ids are opaque; treating "ME" as "me" would be a guess, and the server is the real arbiter.
    expect(canApprove({ requesterId: "ME" }, { id: "me" })).toBe(true);
  });
});
