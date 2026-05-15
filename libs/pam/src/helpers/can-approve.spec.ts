import { canApprove } from "./can-approve";

describe("canApprove", () => {
  it("returns false when the requester and current user are the same", () => {
    expect(canApprove({ requesterUserId: "user-1" }, { id: "user-1" })).toBe(false);
  });

  it("returns true when the requester and current user are different", () => {
    expect(canApprove({ requesterUserId: "user-1" }, { id: "user-2" })).toBe(true);
  });
});
