import {
  SendItemDialogResult,
  isSendItemDialogResult,
  asSendItemDialogResult,
  nameOfSendItemDialogResult,
} from "./send-add-edit-dialog.component";

describe("SendItemDialogResult utilities", () => {
  it("accepts known results", () => {
    const results: Array<any> = [SendItemDialogResult.Saved, SendItemDialogResult.Deleted];
    results.forEach((r) => {
      expect(isSendItemDialogResult(r)).toBe(true);
      expect(asSendItemDialogResult(r)).toBe(r);
      expect(nameOfSendItemDialogResult(r)).toBeDefined();
    });
  });

  it("rejects invalid values", () => {
    const invalid: Array<any> = ["save", "del", 0, 1, null, undefined, {}, []];
    invalid.forEach((v) => {
      expect(isSendItemDialogResult(v)).toBe(false);
      expect(asSendItemDialogResult(v)).toBeUndefined();
      expect(nameOfSendItemDialogResult(v as any)).toBeUndefined();
    });
  });

  it("returns the correct key name", () => {
    expect(nameOfSendItemDialogResult(SendItemDialogResult.Saved)).toBe("Saved");
    expect(nameOfSendItemDialogResult(SendItemDialogResult.Deleted)).toBe("Deleted");
  });
});
