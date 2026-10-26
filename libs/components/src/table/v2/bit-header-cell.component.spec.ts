import { reflectComponentType } from "@angular/core";

// The only static import of the table v2 files, so this module loads before bit-column, which it
// imports and which queries for it. A consumer importing just the header cell meets that order.
import { BitHeaderCellComponent } from "./bit-header-cell.component";

describe("BitHeaderCellComponent", () => {
  it("leaves bit-column's header query intact when it loads before bit-column", async () => {
    const { BitColumnComponent } = await import("./bit-column.component");

    expect(reflectComponentType(BitHeaderCellComponent)?.selector).toBe("bit-header-cell");
    expect(reflectComponentType(BitColumnComponent)?.selector).toBe("bit-column");
  });
});
