import { BulkActionResult, failUnreported } from "./member-actions.types";

describe("failUnreported", () => {
  const excluded = "Excluded, not applicable for this action";

  it("returns the result unchanged when every sent member has a row", () => {
    const result: BulkActionResult = {
      successful: [{ id: "a" }],
      failed: [{ id: "b", error: "Already accepted" }],
    };

    expect(failUnreported(["a", "b"], result, excluded)).toBe(result);
  });

  it("fails every sent member without a row as excluded, after the reported failures", () => {
    const result: BulkActionResult = {
      successful: [{ id: "a" }],
      failed: [{ id: "b", error: "Already accepted" }],
    };

    expect(failUnreported(["a", "b", "c", "d"], result, excluded)).toEqual({
      successful: [{ id: "a" }],
      failed: [
        { id: "b", error: "Already accepted" },
        { id: "c", error: excluded },
        { id: "d", error: excluded },
      ],
    });
  });
});
