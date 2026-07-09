# bit-table-v2 — TODO

Tracked follow-ups for the v2 table. Keep entries short; link to the code they touch.

## Virtual scroll + row groups

Grouping (`<bit-row-group>`) composes with virtualization: a single viewport renders the
interleaved group headers and rows, positioned by `TableVirtualScrollStrategy`
(`table-virtual-scroll.strategy.ts`) from per-item heights. Remaining:

- **Sticky section headers.** Headers scroll away with their group rather than pinning to
  the top of the viewport. Needs sticky positioning within CDK's transformed content.
- **Header-height precision.** Header heights are fixed constants (`GROUP_HEADER_HEIGHT` /
  `SUBGROUP_HEADER_HEIGHT` in `table-v2.component.ts`) forced onto the rendered header, so a
  header taller than its constant clips. If variable-height headers are ever needed, measure
  instead — and move the knob onto `<bit-row-group>` (which owns the header content).
- **Buffer hysteresis.** The strategy over-scans a single fixed `BUFFER_PX` (200) each side and
  recomputes the range every scroll. CDK's fixed-size strategy uses `minBufferPx`/`maxBufferPx`
  hysteresis (top up in chunks) for fewer re-renders under fast scrolling; adopt that if the
  churn matters.

## Row groups — remaining

- **Persisted collapse state.** `collapsible` keeps open/closed state internally
  (`bit-row-group.component.ts`). Expose it as a `model()` so consumers (e.g. the extension's
  `VaultPopupSectionService`) can two-way-bind and persist it.
- **Collapse animation.** Rows are conditionally rendered; the extension uses `bit-disclosure`
  for the slide. Route collapse through `bit-disclosure` if we want the animation.
- **Dynamic-group helper.** A `bit-row-group-az` (and folder) helper that `@for`s a key set into
  predicate `<bit-row-group>`s, for group sets too large to declare by hand.

## Horizontal scroll — remaining

Fixed-width columns wider than the table scroll horizontally, with the header row synced to the
body's `scrollLeft` for both the non-virtualized div and the CDK viewport (`table-v2.component.html`,
`ManyColumns` story). Follow-up: a **sticky first column** (`position: sticky; left: 0` on the lead
track — e.g. name or the selection checkbox) so it stays visible while the rest scrolls.

## Presentation

- **List-mode sort control.** Sort headers are hidden in `list` presentation (no focusable
  affordance); add a sort menu bound to the same `[(sort)]` state.
- **List-mode selection affordance.** In-item checkbox for `[selection]` instead of the
  prepended column.
- **Cell sizing.** List rows still use the table cell height/padding (`bit-cell` is `tw-h-16`);
  align with `bit-item` chrome if a pixel match is wanted.
