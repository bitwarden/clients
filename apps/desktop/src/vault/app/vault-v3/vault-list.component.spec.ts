import { optionsColumnWidthClass, OWNER_COLUMN_WIDTH_CLASS } from "./vault-list.component";

describe("vault list column widths", () => {
  describe("optionsColumnWidthClass", () => {
    it("reserves room for an icon per copyable field when quick copy actions are shown", () => {
      // launch + 3 copy icons + overflow trigger + cell padding ≈ 209px
      expect(optionsColumnWidthClass(true)).toBe("tw-w-56");
    });

    it("reserves room for a single combined copy button otherwise", () => {
      // launch + 1 copy button + overflow trigger + cell padding ≈ 145px
      expect(optionsColumnWidthClass(false)).toBe("tw-w-40");
    });
  });

  describe("OWNER_COLUMN_WIDTH_CLASS", () => {
    it("reserves room for the owner badge", () => {
      // The badge is truncated to 13 characters, running to ~120px plus cell padding.
      expect(OWNER_COLUMN_WIDTH_CLASS).toBe("tw-w-40");
    });
  });
});
