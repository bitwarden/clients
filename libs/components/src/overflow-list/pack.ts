export interface PackedItems {
  /** Indices that should be visible in the row. When pinIndex is set, it is always in this list. */
  displayed: readonly number[];
  /** Indices that should be rendered in the overflow affordance instead. */
  overflow: readonly number[];
}

/**
 * Pure pack function — given measurements, decide which items fit and which overflow.
 * The pinned item (if any) is always kept in `displayed` and reinserted at its ordinal
 * position so visible order matches DOM order.
 *
 * Returns "all displayed" when measurements aren't ready yet (containerWidth <= 0).
 *
 * @param itemWidths     Natural widths of each item in DOM order, in pixels.
 * @param containerWidth Available width for the row, in pixels.
 * @param gap            Horizontal gap between adjacent items, in pixels.
 * @param pinIndex       Item to keep visible no matter what, or null for first-fit only.
 */
export function pack(
  itemWidths: readonly number[],
  containerWidth: number,
  gap: number,
  pinIndex: number | null,
): PackedItems {
  const count = itemWidths.length;
  const all = Array.from({ length: count }, (_, i) => i);

  if (containerWidth <= 0) {
    return { displayed: all, overflow: [] };
  }

  const totalWidth = itemWidths.reduce((sum, w, i) => sum + w + (i > 0 ? gap : 0), 0);
  if (totalWidth <= containerWidth) {
    return { displayed: all, overflow: [] };
  }

  if (pinIndex !== null && pinIndex >= 0 && pinIndex < count) {
    const available = containerWidth - itemWidths[pinIndex];
    const displayed: number[] = [];
    const overflow: number[] = [];
    let used = 0;

    for (let i = 0; i < count; i++) {
      if (i === pinIndex) {
        continue;
      }
      const w = itemWidths[i] + gap;
      if (used + w > available) {
        for (let j = i; j < count; j++) {
          if (j !== pinIndex) {
            overflow.push(j);
          }
        }
        break;
      }
      used += w;
      displayed.push(i);
    }

    // Reinsert the pinned item at its ordinal position so visible order matches DOM order.
    const insertPos = displayed.findIndex((j) => j > pinIndex);
    if (insertPos === -1) {
      displayed.push(pinIndex);
    } else {
      displayed.splice(insertPos, 0, pinIndex);
    }

    return { displayed, overflow };
  }

  // No pinning — simple first-fit.
  const displayed: number[] = [];
  const overflow: number[] = [];
  let used = 0;
  for (let i = 0; i < count; i++) {
    const w = itemWidths[i] + (i > 0 ? gap : 0);
    if (used + w > containerWidth) {
      for (let j = i; j < count; j++) {
        overflow.push(j);
      }
      break;
    }
    used += w;
    displayed.push(i);
  }
  return { displayed, overflow };
}
