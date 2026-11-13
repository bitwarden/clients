import type { FilterEntry, FilterOptionRow, FilterRow } from "./filter-model";

/** One row of a multi-select menu's flattened tree. */
export type FilterTreeNode = {
  row: FilterRow;
  /** Index of this row's parent in the flattened list; `null` at the top level. */
  parent: number | null;
  /** Whether the row's children are shown — its own state, or forced open while searching. */
  expanded: boolean;
  level: number;
  /**
   * The row's depth for indentation, which can be shallower than {@link level}: a section
   * is drawn as its group's header rather than a parent row, so its options sit at the
   * group's base indent even though they are its tree children.
   */
  indent: number;
  setsize: number;
  posinset: number;
  /**
   * Whether a row without a chevron still reserves its column, so checkboxes line up.
   * Scoped to the row's own group, so a section with nothing to expand sits at the base indent.
   */
  reserveExpander: boolean;
  /**
   * Whether a `bit-filter-option-divider` sits immediately before this row. The popover
   * draws a line; the dialog hides it and lets the group gap carry the separation.
   */
  dividerBefore: boolean;
  /**
   * First and last row of a top-level group — a section with its descendants, or a run of
   * loose top-level rows. A surface that draws a card per group reads these for its edges;
   * with no sections the whole list is one group.
   */
  groupStart: boolean;
  groupEnd: boolean;
};

/** Whether anything in this run of options, at any depth, can expand. */
function groupExpands(options: readonly FilterOptionRow[]): boolean {
  return options.some((option) => option.expandable || groupExpands(option.childRows));
}

/**
 * Flag each node's group boundaries, in place. A group is a section with its descendants,
 * or a run of loose top-level rows; a divider ends the run it follows. Walks `entries`
 * rather than the nodes, since a divider produces no node of its own.
 */
function markGroups(nodes: FilterTreeNode[], entries: readonly FilterEntry[]): void {
  // Nodes are depth-first, so the top-level rows sit at the `level === 1` indices in the
  // same order as the entries that produced them.
  const topLevel = nodes.reduce<number[]>((indices, node, index) => {
    if (node.level === 1) {
      indices.push(index);
    }
    return indices;
  }, []);

  let cursor = 0;
  let breakBefore = true;
  let afterSection = false;
  let afterDivider = false;
  for (const entry of entries) {
    if (entry.kind === "divider") {
      afterDivider = true;
      continue;
    }
    const section = entry.kind === "section";
    const index = topLevel[cursor++];
    if (index == null) {
      continue;
    }
    if (section || afterSection || afterDivider) {
      breakBefore = true;
    }
    if (breakBefore) {
      nodes[index].groupStart = true;
      // Only when a row precedes it: a search can hide everything above a divider, and a
      // rule above the first result divides nothing.
      nodes[index].dividerBefore = afterDivider && index > 0;
      if (index > 0) {
        nodes[index - 1].groupEnd = true;
      }
    }
    breakBefore = false;
    afterSection = section;
    afterDivider = false;
  }

  if (nodes.length > 0) {
    nodes[nodes.length - 1].groupEnd = true;
  }
}

/** The multi-select rows, flattened in document order, each carrying its own level. */
export function buildTreeNodes(
  allEntries: readonly FilterEntry[],
  rowVisible: (row: FilterRow) => boolean,
  rowExpanded: (row: FilterRow) => boolean,
): FilterTreeNode[] {
  const nodes: FilterTreeNode[] = [];
  const push = (
    rows: readonly FilterRow[],
    level: number,
    indent: number,
    parent: number | null,
    reserveExpander: boolean,
  ) => {
    const visible = rows.filter(rowVisible);
    visible.forEach((row, index) => {
      const expanded = rowExpanded(row);
      const self = nodes.length;
      nodes.push({
        row,
        parent,
        expanded,
        level,
        indent,
        setsize: visible.length,
        posinset: index + 1,
        reserveExpander,
        dividerBefore: false,
        groupStart: false,
        groupEnd: false,
      });
      // Children, not `expandable`: a non-collapsible section still shows its options.
      const children = row.childRows;
      if (expanded && children.length > 0) {
        // A section is its own group: it reserves only if something inside it expands.
        const section = row.kind === "section";
        const reserve = section ? groupExpands(children) : reserveExpander;
        // A section heads its group rather than parenting a row, so its options hold the
        // section's own indent instead of stepping in from it.
        push(children, level + 1, section ? indent : indent + 1, self, reserve);
      }
    });
  };

  // Dividers aren't rows, so they're held back for the group pass below.
  const entries = allEntries.filter(
    (entry) => entry.kind === "divider" || rowVisible(entry as FilterRow),
  );
  const rows = entries.filter((entry): entry is FilterRow => entry.kind !== "divider");
  // Top-level rows align with each other: anything expandable on that line means every
  // row on it reserves the column.
  push(
    rows,
    1,
    1,
    null,
    rows.some((row) => row.expandable),
  );
  markGroups(nodes, entries);
  return nodes;
}

/** A rendered tree row, carrying the node it draws. */
export type FilterTreeRowElement = HTMLElement & { filterNode: FilterTreeNode };

export type FilterTreeActions = {
  activate(node: FilterTreeNode): void;
};

/**
 * Keyboard handling for the multi-select tree, replacing the CDK's `TreeKeyManager` (typeahead
 * left off — optional for a tree, and the menu already has a search field). Works on whichever
 * surface rendered the tree, popover or dialog, by reading the rows from the event's tree element.
 */
export function onTreeKeydown(event: KeyboardEvent, actions: FilterTreeActions): void {
  const tree = event.currentTarget as HTMLElement;
  const rows = Array.from(tree.querySelectorAll<FilterTreeRowElement>(":scope > [role=treeitem]"));
  const current = rows.find(
    (row) => row === (tree.getRootNode() as Document | ShadowRoot).activeElement,
  );
  if (!current) {
    return;
  }
  const index = rows.indexOf(current);
  const node = current.filterNode;
  const enabled = (row: FilterTreeRowElement) => !row.filterNode.row.disabled;
  const focusRow = (row: FilterTreeRowElement | undefined) => row?.focus();
  const rtl = getComputedStyle(tree).direction === "rtl";
  const key =
    rtl && event.key === "ArrowLeft"
      ? "ArrowRight"
      : rtl && event.key === "ArrowRight"
        ? "ArrowLeft"
        : event.key;
  const expanded = node.row.expandable && node.expanded;

  switch (key) {
    case "ArrowDown":
      focusRow(rows.slice(index + 1).find(enabled));
      break;
    case "ArrowUp":
      focusRow(rows.slice(0, index).reverse().find(enabled));
      break;
    case "Home":
      focusRow(rows.find(enabled));
      break;
    case "End":
      focusRow([...rows].reverse().find(enabled));
      break;
    case "ArrowRight":
      if (!node.row.expandable) {
        break;
      }
      if (!expanded) {
        node.row.toggleExpanded();
      } else {
        focusRow(rows.find((row) => row.filterNode.parent === index && enabled(row)));
      }
      break;
    case "ArrowLeft":
      if (expanded) {
        node.row.toggleExpanded();
      } else if (node.parent != null) {
        focusRow(rows[node.parent]);
      }
      break;
    case "*":
      rows
        .filter((row) => row.filterNode.parent === node.parent)
        .forEach((row) => {
          if (row.filterNode.row.expandable && !row.filterNode.expanded) {
            row.filterNode.row.toggleExpanded();
          }
        });
      break;
    case "Enter":
    case " ":
      if (!node.row.disabled) {
        actions.activate(node);
      }
      break;
    default:
      return;
  }
  event.preventDefault();
}
