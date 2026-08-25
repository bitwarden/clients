/**
 * Helpers for asserting how a `bit-table` reflows as its container narrows.
 *
 * The requests tables live inside `bit-layout`'s main content area, which is a container-query
 * root, so their secondary columns fall away on the width of the *pane* rather than the viewport —
 * the drawer takes half the pane while the viewport stays wide. jsdom has no layout, so a spec can
 * only assert the declared ladder: that a hidden column names the container width that brings it
 * back, and that a header and its body cells hide together.
 */

/** The container-query variant a column reappears at (e.g. `@2xl`), or null when it always shows. */
export type ColumnVisibility = string | null;

const HIDDEN = /(^|\s)tw-hidden(\s|$)/;
const SHOWN_AT = /(@[^\s:]+):tw-table-cell/;

/** Read one cell's declared visibility, rejecting a column that hides with no way back. */
export function columnVisibility(cell: Element): ColumnVisibility {
  const classes = cell.getAttribute("class") ?? "";
  if (!HIDDEN.test(classes)) {
    return null;
  }
  const shownAt = SHOWN_AT.exec(classes);
  if (shownAt == null) {
    throw new Error(`A hidden column names no container width that restores it: "${classes}"`);
  }
  return shownAt[1];
}

/** Every table's header row and first body row, read column by column. */
export function tableColumnVisibility(
  root: Element,
): { header: ColumnVisibility[]; body: ColumnVisibility[] }[] {
  return Array.from(root.querySelectorAll("table"), (table) => {
    const firstRow = table.querySelector("tbody tr");
    if (firstRow == null) {
      throw new Error("A table under test rendered no rows, so its columns cannot be compared");
    }
    return {
      header: Array.from(table.querySelectorAll("thead th"), columnVisibility),
      body: Array.from(firstRow.children, columnVisibility),
    };
  });
}
