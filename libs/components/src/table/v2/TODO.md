# bit-table-v2 — TODO

Tracked follow-ups for the v2 table. Keep entries short; link to the code they touch.

## Virtual scroll + row groups

Grouping (`<bit-row-group>`) currently renders only in the **non-virtualized** body
(`table-v2.component.html`). Virtualization (`virtualRowHeight`) and grouping don't compose yet:

- CDK's fixed-size strategy assumes one item height, but group headers and rows differ.
- Needs a custom two-height `VirtualScrollStrategy` (header height vs row height) or
  `cdkAutosizeVirtualScroll`, plus sticky section headers inside the transformed viewport.
- Until then, grouping + virtualization should warn/no-op.

## Row groups — remaining

- **Persisted collapse state.** `collapsible` keeps open/closed state internally
  (`bit-row-group.component.ts`). Expose it as a `model()` so consumers (e.g. the extension's
  `VaultPopupSectionService`) can two-way-bind and persist it.
- **Collapse animation.** Rows are conditionally rendered; the extension uses `bit-disclosure`
  for the slide. Route collapse through `bit-disclosure` if we want the animation.
- **Dynamic-group helper.** A `bit-row-group-az` (and folder) helper that `@for`s a key set into
  predicate `<bit-row-group>`s, for group sets too large to declare by hand.
- **ARIA.** Group headers render as plain elements; revisit `role="rowgroup"` / heading semantics.

## Presentation

- **List-mode sort control.** Sort headers are hidden in `list` presentation (no focusable
  affordance); add a sort menu bound to the same `[(sort)]` state.
- **List-mode selection affordance.** In-item checkbox for `[selection]` instead of the
  prepended column.
- **Cell sizing.** List rows still use the table cell height/padding (`bit-cell` is `tw-h-16`);
  align with `bit-item` chrome if a pixel match is wanted.
