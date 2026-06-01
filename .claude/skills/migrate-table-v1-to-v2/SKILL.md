---
name: migrate-table-v1-to-v2
description: Migrates a single Bitwarden table from the v1 `bit-table` / `bit-table-scroll` API to the column-driven `bit-table-v2` API. Use when the user asks to "migrate a table to v2", "convert bit-table to bit-table-v2", "move this table to the v2 API", or points at a `bit-table`/`bit-table-scroll` consumer and asks to upgrade it. DO NOT invoke for general table styling, data-source bugs, or questions that don't involve the v1→v2 API change.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(npm run build:*), Bash(npx nx build:*), Bash(npm run lint:*), Bash(npx jest:*)
---

# Migrate a table from v1 to v2

`bit-table-v2` is a column-driven evolution of the row-driven `bit-table`. This skill converts one
table at a time: read the v1 template + its component, map each construct to its v2 shape, and verify
the result builds and lints.

The shared `TableDataSource<T>` carries over **unchanged** — sorting, filtering, and the data array
all work the same. The migration is almost entirely a template rewrite plus a few component-side
additions (`displayedColumns`, optionally a `SelectionModel`).

## Before you start

- **Confirm the migration is wanted.** The v2 docs note the legacy `bit-table` "isn't being
  migrated" as a blanket effort — v1 still works. So this is an opt-in, per-table upgrade. If the
  user hasn't clearly asked to migrate _this_ table, confirm before rewriting.
- **One table per invocation.** Migrate the single table the user points at, verify it, and stop.
  Don't sweep a directory unless the user explicitly asks for each table in turn.
- **Read both files first.** The `.html` template and its `.component.ts`. You need the row type,
  the `TableDataSource` (or raw array), the column keys, sort config, and any selection/virtual-
  scroll wiring before you can write the v2 markup.

## Decide the mode

Look at what the v1 table actually does:

| v1 signals                                                                 | v2 target                                       |
| -------------------------------------------------------------------------- | ----------------------------------------------- |
| Has `[dataSource]`, `bitSortable`, filtering, selection, or virtualization | **Column-def mode** — `<bit-column>` per column |
| `bit-table-scroll` / `[rowSize]` / `bitRowDef`                             | Column-def mode **+ `[rowSize]`** (virtual)     |
| No data source, no sort/filter/select — just static `*ngFor` rows          | **Manual mode** — project `<bit-row>` directly  |

Column-def is the default and the only mode that supports sort, filter, selection, and
virtualization. Use manual mode only for genuinely presentational tables. **Never mix the two** in
one table.

## Workflow

1. **Read** the template and component. Identify: row type `T`, the data source, every column (its
   header text, its data key, sortable?, `default`/`fn`?), selection, virtual scroll.
2. **Establish the row type.** Column-def mode needs `ds.columns.<key>` to be typed. If the existing
   `TableDataSource` is `TableDataSource<any>` or untyped, give it a concrete `T` so
   `ds.columns.<key>` autocompletes and typos fail to compile. This is the single biggest win of v2 —
   don't skip it.
3. **Add `displayedColumns`** to the component: a `string[]` of column keys in render order. Required
   in column-def mode — columns not listed don't render.
4. **Rewrite the template** following `migration-patterns.md`. One `<bit-column>` per v1 column.
5. **Move column metadata to the wrapper.** `bitSortable="key"` → `sortable` on `<bit-column>`;
   `default`/`default="desc"` → `defaultSort="asc|desc"`; `[fn]` → `[sortFn]`. The data key moves
   from `bitSortable` to the `*bitCellDef="ds.columns.key"` reference.
6. **Translate cells.** `td[bitCell]` → `<bit-cell *bitCellDef="ds.columns.key; let row">`. Preserve
   the inner markup, but **also** lift it into v2's slot vocab where it clearly maps (leading icon →
   `slot=start`, subtitle/secondary text → `slot=secondary`, trailing affordance → `slot=end`). See
   "Cell layout" in the patterns file.
7. **Update imports.** Swap the v1 `TableModule` import for the v2 standalone components
   (`BitTableV2Component`, `BitColumnComponent`, `BitHeaderCellComponent`, `BitCellComponent`,
   `BitCellDefDirective`, and `BitHeaderRowComponent`/`BitRowComponent` for manual mode). All are
   exported from `@bitwarden/components`.
8. **Verify.** Build the affected app/lib and run lint on both `.ts` and `.html`. If the component
   has a Storybook story, confirm it still renders. Report results honestly.

## Critical rules

- **The data key lives on `*bitCellDef`, not on the header.** In v1 `bitSortable="name"` carried both
  "this column is sortable" and "sort by the `name` field". In v2 those split: `sortable` (boolean)
  goes on `<bit-column>`, and the field key is the `ds.columns.name` reference on `*bitCellDef`. Sort
  uses that same key. Forgetting this is the most common migration bug.
- **Every column needs a `<bit-header-cell>`** — even action/checkbox columns. Use an empty
  `<bit-header-cell></bit-header-cell>` rather than omitting it; screen readers rely on it.
- **Don't declare a selection/checkbox column.** When you pass `[selection]`, the table prepends its
  own checkbox column. Delete any hand-rolled select-all/row-checkbox column from the v1 markup.
- **Action columns use `synthetic()`**, not `columns.x`: `*bitCellDef="ds.synthetic('actions'); let row"`.
  `synthetic()` still threads the row type so `let row` stays typed.
- **Tailwind classes keep the `tw-` prefix.** When restructuring cells, don't drop or mangle prefixes.
- **Preserve existing comments** in the template and component as you rewrite.

## Reference

`migration-patterns.md` — full before/after for every construct: headers + sortable, body rows,
virtual scroll, selection + bulk actions, filtering, rich/slot cells, synthetic columns, and manual
mode. Read it before rewriting; the mappings are exact.

The component source is the ground truth if anything is ambiguous:
`libs/components/src/table/v2/` and `libs/components/src/table/table-data-source.ts`. The rendered
v2 docs live at `libs/components/src/table/v2/table-v2.mdx`.
