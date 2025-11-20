import { SendItemDialogResult } from "./send-add-edit-dialog.component";

describe("SendItemDialogResult", () => {
  it("has the expected result values", () => {
    expect(SendItemDialogResult.Saved).toBe("saved");
    expect(SendItemDialogResult.Deleted).toBe("deleted");
  });

  it("has exactly two result values", () => {
    const keys = Object.keys(SendItemDialogResult);
    expect(keys.length).toBe(2);
    expect(keys).toContain("Saved");
    expect(keys).toContain("Deleted");
  });

  it("is frozen and immutable", () => {
    expect(Object.isFrozen(SendItemDialogResult)).toBe(true);
  });
});
