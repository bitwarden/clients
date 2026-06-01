# v1 → v2 migration patterns

Exact before/after mappings for converting a `bit-table` / `bit-table-scroll` to `bit-table-v2`.
The shared `TableDataSource<T>` is unchanged — only the template and a few component bindings move.

All v2 components are exported from `@bitwarden/components`:
`BitTableV2Component`, `BitColumnComponent`, `BitHeaderCellComponent`, `BitCellComponent`,
`BitCellDefDirective`, `BitHeaderRowComponent`, `BitRowComponent`.

---

## 1. Basic table with a data source

The core shape change: v1 declares headers and rows separately (row-driven); v2 declares one
`<bit-column>` per column, each pairing a header cell with a per-row cell template (column-driven).

**v1**

```html
<bit-table [dataSource]="dataSource">
  <ng-container header>
    <tr>
      <th bitCell>Id</th>
      <th bitCell>Name</th>
      <th bitCell>Email</th>
    </tr>
  </ng-container>
  <ng-template body let-rows$>
    <tr bitRow *ngFor="let r of rows$ | async">
      <td bitCell>{{ r.id }}</td>
      <td bitCell>{{ r.name }}</td>
      <td bitCell>{{ r.email }}</td>
    </tr>
  </ng-template>
</bit-table>
```

**v2**

```html
<bit-table-v2 [dataSource]="dataSource" [displayedColumns]="displayedColumns">
  <bit-column>
    <bit-header-cell>Id</bit-header-cell>
    <bit-cell *bitCellDef="dataSource.columns.id; let row">{{ row.id }}</bit-cell>
  </bit-column>
  <bit-column>
    <bit-header-cell>Name</bit-header-cell>
    <bit-cell *bitCellDef="dataSource.columns.name; let row">{{ row.name }}</bit-cell>
  </bit-column>
  <bit-column>
    <bit-header-cell>Email</bit-header-cell>
    <bit-cell *bitCellDef="dataSource.columns.email; let row">{{ row.email }}</bit-cell>
  </bit-column>
</bit-table-v2>
```

Component side:

```ts
// The data source must be typed for `columns.id` etc. to resolve.
protected readonly dataSource = new TableDataSource<User>();
protected readonly displayedColumns = ["id", "name", "email"];
```

Notes:

- `*ngFor` / `rows$ | async` disappears — the table iterates the data source itself and stamps
  the `*bitCellDef` template per row.
- `let row` is typed as the row type `T` (via `ngTemplateContextGuard`), so `row.emial` fails to
  compile. This typing is the main reason to migrate; always give the data source a concrete `T`.
- Columns render in `[displayedColumns]` order. A column whose key isn't listed won't render even
  though it's declared — this is also how you reorder or conditionally hide columns.

---

## 2. Sortable headers

The single most error-prone mapping. In v1, `bitSortable="name"` did double duty: it marked the
column sortable **and** named the field to sort by. In v2 those split:

- `sortable` (boolean) → on `<bit-column>`
- the field key → the `*bitCellDef="ds.columns.name"` reference (sort reads this same key)
- `default` / `default="desc"` → `defaultSort="asc"` / `defaultSort="desc"` on `<bit-column>`
- `[fn]="sortFn"` → `[sortFn]="sortFn"` on `<bit-column>`

**v1**

```html
<th bitCell bitSortable="id" default>Id</th>
<th bitCell bitSortable="name" default="desc">Name</th>
<th bitCell bitSortable="other" [fn]="sortFn">Other</th>
```

**v2**

```html
<bit-column sortable defaultSort="asc">
  <bit-header-cell>Id</bit-header-cell>
  <bit-cell *bitCellDef="dataSource.columns.id; let row">{{ row.id }}</bit-cell>
</bit-column>
<bit-column sortable defaultSort="desc">
  <bit-header-cell>Name</bit-header-cell>
  <bit-cell *bitCellDef="dataSource.columns.name; let row">{{ row.name }}</bit-cell>
</bit-column>
<bit-column sortable [sortFn]="sortFn">
  <bit-header-cell>Other</bit-header-cell>
  <bit-cell *bitCellDef="dataSource.columns.other; let row">{{ row.other }}</bit-cell>
</bit-column>
```

The sort-button affordance, `aria-sort`, and `aria-pressed` are added automatically by
`<bit-header-cell>` when its column is `sortable` — drop any manual icon/button markup from the v1
header. `bitSortable="" ` (empty, used in v1 to conditionally disable sort) just becomes the
**absence** of `sortable`.

`SortFn` signatures are unchanged:

```ts
sortByName = (a: User, b: User, direction?: SortDirection) => {
  const result = a.name.localeCompare(b.name);
  return direction === "asc" ? result : -result;
};
```

---

## 3. Virtual scrolling (`bit-table-scroll` → `[rowSize]`)

v1 used a separate `bit-table-scroll` component with a `bitRowDef` template. v2 folds
virtualization into the same component: set `[rowSize]` (row height in px) and, optionally,
`[trackBy]`.

**v1**

```html
<bit-table-scroll [dataSource]="dataSource" rowSize="47">
  <ng-container header>
    <th bitCell bitSortable="id" default>Id</th>
    <th bitCell bitSortable="name">Name</th>
  </ng-container>
  <ng-template bitRowDef let-row>
    <td bitCell>{{ row.id }}</td>
    <td bitCell>{{ row.name }}</td>
  </ng-template>
</bit-table-scroll>
```

**v2**

```html
<bit-table-v2
  [dataSource]="dataSource"
  [displayedColumns]="['id', 'name']"
  [rowSize]="47"
  [trackBy]="trackById"
>
  <bit-column sortable defaultSort="asc">
    <bit-header-cell>Id</bit-header-cell>
    <bit-cell *bitCellDef="dataSource.columns.id; let row">{{ row.id }}</bit-cell>
  </bit-column>
  <bit-column sortable>
    <bit-header-cell>Name</bit-header-cell>
    <bit-cell *bitCellDef="dataSource.columns.name; let row">{{ row.name }}</bit-cell>
  </bit-column>
</bit-table-v2>
```

- `[rowSize]` forces `table-fixed` layout — give columns explicit `width="…"` (or `1fr`) for stable,
  cross-row-aligned tracks. Intrinsic keywords (`max-content`, `auto`) won't align across rows under
  virtualization.
- `bitRowDef let-row` had one template for all cells; in v2 each column owns its own cell template,
  so split the old single template's `<td>`s into per-column `<bit-cell>`s.
- The old `bitRowDef`'s `let-row` was untyped; the v2 `let row` is typed `T`.

---

## 4. Selection + bulk actions

Do **not** hand-roll a checkbox column. Pass a `SelectionModel<T>` and the table prepends its own
checkbox column with a select-all header (targeting `dataSource.filteredData`).

```ts
protected readonly selection = new SelectionModel<User>(true, []);
```

```html
<bit-table-v2
  [dataSource]="dataSource"
  [selection]="selection"
  [displayedColumns]="['id', 'name', 'email']"
>
  <!-- declare only your real columns; the checkbox column is generated -->
  …columns…
</bit-table-v2>
```

If the v1 table had a manual select-all `<th>` + per-row checkbox `<td>`, **delete both** — they're
replaced by the generated column.

Bulk actions: a `<bit-bulk-actions-bar>` projected inside the table reads the selection count
implicitly via DI and its clear button clears the model — no explicit `[selectedCount]` / `(clear)`
wiring needed inside a table.

```html
<bit-table-v2 [dataSource]="dataSource" [selection]="selection" [displayedColumns]="cols">
  <bit-bulk-actions-bar>
    <bit-bulk-action [action]="onDelete" icon="bwi-trash" label="Delete" />
  </bit-bulk-actions-bar>
  …columns…
</bit-table-v2>
```

---

## 5. Filtering

Unchanged — filtering lives entirely on the data source in both versions:

```ts
dataSource.filter = "search value";
// or
dataSource.filter = (row) => row.orgType === "family";
```

No template change required.

---

## 6. Cell layout — slots (mechanical + design upgrade)

Translate `td[bitCell]` structurally to `<bit-cell>`, and lift the inner markup into v2's slot
vocabulary where the old markup clearly maps. `<bit-cell>` exposes four slots: `slot=start` (leading
icon/tile), default (title), `slot=secondary` (subtitle), `slot=end` (trailing affordance).
`secondary` and `end` collapse when empty, so plain cells need only the default slot.

**v1** — leading icon + title + subtitle hand-laid with flex utilities:

```html
<td bitCell class="tw-flex tw-gap-2 tw-items-center">
  <bit-icon [name]="row.icon" class="bwi-lg"></bit-icon>
  <div>
    <span>{{ row.displayName }}</span>
    <div class="tw-text-sm tw-text-muted">{{ row.email }}</div>
  </div>
</td>
```

**v2** — same content, expressed through slots:

```html
<bit-cell *bitCellDef="dataSource.columns.name; let row">
  <bit-icon-tile slot="start" [icon]="row.icon" size="sm" />
  {{ row.displayName }}
  <span slot="secondary">{{ row.email }}</span>
</bit-cell>
```

Guidance:

- Map leading icons/avatars → `slot=start`, muted subtitles → `slot=secondary`, trailing
  buttons/badges → `slot=end`. Drop the now-redundant flex/gap utilities the slot layout provides.
- `truncate` (default `true`) controls ellipsis on title + secondary; set `[truncate]="false"` to
  let them wrap if the v1 cell wrapped.
- If the inner markup doesn't map cleanly to slots (complex custom layout), keep it verbatim in the
  default slot rather than forcing it — mechanical correctness first.
- Keep the `tw-` prefix on every Tailwind class you carry over.

---

## 7. Action columns (`synthetic()`)

Columns that don't map to a field on `T` — action menus, expand toggles — use `synthetic()` for the
`*bitCellDef` reference, and give them an empty header.

**v1**

```html
<th bitCell></th>
…
<td bitCell>
  <button bitIconButton="bwi-ellipsis-v" [bitMenuTriggerFor]="menu"></button>
</td>
```

**v2**

```html
<bit-column width="50px">
  <bit-header-cell></bit-header-cell>
  <bit-cell *bitCellDef="dataSource.synthetic('actions'); let row">
    <button bitIconButton="bwi-ellipsis-v" [bitMenuTriggerFor]="menu"></button>
  </bit-cell>
</bit-column>
```

Add `'actions'` (whatever key you pass to `synthetic()`) to `displayedColumns`. `synthetic()` still
threads the row type, so `let row` is typed `T`.

---

## 8. Manual mode (presentational tables, no data source)

If the v1 table had no `[dataSource]`, no sort, no filter, no selection — just static rows from a
local array — use **manual mode**: project a `<bit-header-row>` and `<bit-row>`s directly, with no
`<bit-column>` and no `[displayedColumns]`.

**v1**

```html
<bit-table>
  <ng-container header>
    <tr>
      <th bitCell>Id</th>
      <th bitCell>Name</th>
    </tr>
  </ng-container>
  <ng-template body>
    <tr bitRow *ngFor="let r of items">
      <td bitCell>{{ r.id }}</td>
      <td bitCell>{{ r.name }}</td>
    </tr>
  </ng-template>
</bit-table>
```

**v2**

```html
<bit-table-v2>
  <bit-header-row>
    <bit-header-cell>Id</bit-header-cell>
    <bit-header-cell>Name</bit-header-cell>
  </bit-header-row>
  @for (r of items(); track r.id) {
  <bit-row>
    <bit-cell>{{ r.id }}</bit-cell>
    <bit-cell>{{ r.name }}</bit-cell>
  </bit-row>
  }
</bit-table-v2>
```

- Mode is automatic: any projected `<bit-column>` ⇒ column-def mode; otherwise manual.
- Columns default to equal share (`1fr` each) — there's no registry to drive per-column widths.
- The moment you need sort/filter/selection/virtualization, switch to column-def mode instead.

---

## 9. Imports checklist

Remove the v1 import (the `TableModule`, or whatever pulled in `bit-table`) and add the v2 standalone
components actually used by the migrated template:

- Column-def mode: `BitTableV2Component`, `BitColumnComponent`, `BitHeaderCellComponent`,
  `BitCellComponent`, `BitCellDefDirective`.
- Manual mode: `BitTableV2Component`, `BitHeaderRowComponent`, `BitRowComponent`,
  `BitHeaderCellComponent`, `BitCellComponent`.

All from `@bitwarden/components`. If the consuming component is NgModule-based, update its module's
`imports`; if standalone, update the component's `imports` array.

---

## Post-migration verification

1. Build the affected app/lib (e.g. `npx nx build components` or the consuming app).
2. Lint **both** `.ts` and `.html` — the pre-commit hook only lints `.ts`, but CI lints `.html` too.
3. If a Storybook story exists for the component, confirm it still renders.
4. Sanity-check sort, filter, selection, and (if virtualized) scrolling behave as before.
