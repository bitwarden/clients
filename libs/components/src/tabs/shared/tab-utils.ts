import { TAB_LIST_CONTAINER_GAP } from "./tab-list-container.directive";

/** Shared CSS classes for tab label content spans. */
export const TAB_LABEL_CONTENT_CLASSES =
  "tw-flex tw-items-center tw-gap-1.5 tw-rounded group-focus-visible/tab-list-item:tw-ring-2 group-focus-visible/tab-list-item:tw-ring-border-focus";

/**
 * Measures the widths of tab elements.
 * Rounds up to prevent edge-case overflow when a tab width is close to the available space.
 */
export function measureTabWidths(elements: HTMLElement[]): number[] {
  return elements.map((el) => Math.ceil(el.getBoundingClientRect().width));
}

/**
 * Measures the width of the "More" button element (including the container gap).
 */
export function measureMoreButtonWidth(moreButtonEl: HTMLElement): number {
  if (!moreButtonEl) {
    return 0;
  }

  // Button may be hidden — temporarily show it to get an accurate measurement
  const wasHidden = moreButtonEl.hidden;
  if (wasHidden) {
    moreButtonEl.hidden = false;
    // Force style recalculation before measuring, as getBoundingClientRect()
    // may return stale dimensions if styles haven't been flushed yet.
    void window.getComputedStyle(moreButtonEl).width;
  }

  const width = moreButtonEl.getBoundingClientRect().width + TAB_LIST_CONTAINER_GAP;

  if (wasHidden) {
    moreButtonEl.hidden = true;
  }

  return width;
}

/**
 * Computes which tab indices should be displayed and which should overflow into the "More" menu.
 * @param tabCount - Total number of tabs.
 * @param tabListRendered - Whether tab measurements are ready. Returns all tabs as displayed when false.
 * @param tabWidths - Measured pixel widths of each tab, indexed by tab order.
 * @param containerWidth - Available width for the tab list in pixels.
 * @param moreButtonWidth - Width of the "More" button (including gap) in pixels.
 * @param selectedIndex - Index of the currently active/selected tab.
 */
export function computeTabOverflow(
  tabCount: number,
  tabListRendered: boolean,
  tabWidths: number[],
  containerWidth: number,
  moreButtonWidth: number,
  selectedIndex: number,
) {
  if (!tabListRendered) {
    return {
      displayed: Array.from({ length: tabCount }, (_, i) => i),
      overflow: [],
      truncateTabIndex: null,
    };
  }

  const allTabs = tabWidths.map((_, i) => i);

  // Total width of all tabs including gaps
  const totalTabsWidth = tabWidths.reduce(
    (sum, w, i) => sum + w + (i > 0 ? TAB_LIST_CONTAINER_GAP : 0),
    0,
  );

  // If all tabs fit without the more button, no overflow needed
  if (totalTabsWidth <= containerWidth) {
    return { displayed: allTabs, overflow: [], truncateTabIndex: null };
  }

  const displayed: number[] = []; // Store indexes of tabs that are displayed
  const overflow: number[] = []; // Store indexes of tabs that are in the "More" overflow menu

  // Reserve space for the more button and the selected tab.
  const selectedTabWidth = tabWidths[selectedIndex] ?? 0;
  const availableWidth = containerWidth - moreButtonWidth - selectedTabWidth;
  let totalWidth = 0;

  for (let i = 0; i < tabWidths.length; i++) {
    if (i === selectedIndex) {
      continue;
    }

    const tabWidth = tabWidths[i] + TAB_LIST_CONTAINER_GAP;
    if (totalWidth + tabWidth > availableWidth) {
      overflow.push(...allTabs.slice(i).filter((j) => j !== selectedIndex));
      break;
    }
    totalWidth += tabWidth;
    displayed.push(i);
  }

  // Determine where to display the selected tab while conserving tab order
  const insertPos = displayed.findIndex((j) => j > selectedIndex);
  // Insert the selected tab as the last displayed tab
  if (insertPos === -1) {
    displayed.push(selectedIndex);
  } else {
    // Display selected tab in its original position
    displayed.splice(insertPos, 0, selectedIndex);
  }

  // Truncate the first displayed tab if it's the selected tab and there are overflowed tabs
  const truncateTabIndex =
    displayed.length === 1 && overflow.length > 0 && availableWidth < 0 ? selectedIndex : null;

  return { displayed, overflow, truncateTabIndex };
}
