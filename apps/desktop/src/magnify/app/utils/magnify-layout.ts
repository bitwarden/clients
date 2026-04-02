/*
  Height constants for each region of the magnify window (in pixels).
  These must stay in sync with the CSS dimensions of their respective components.

  SEARCH_BAR_HEIGHT    — explicit height of .search-bar in search-bar.css
  RESULTS_TOP_PAD      — .results-list padding-top (6px) + .results-wrapper border-top (1px)
  RESULTS_BOTTOM_PAD   — .results-list padding-bottom
  RESULT_ITEM_HEIGHT   — each .result-item: 32px icon element (26px + 3px padding each side) + 12px item padding + 2px item margin
  ACTION_BAR_HEIGHT    — explicit height of .action-bar (30px) + its border-top (1px)
  NO_RESULTS_HEIGHT    — .no-results padding-top (32px) + font (~16px) + padding-bottom (32px)
  MAX_VISIBLE_ITEMS    — maximum number of result rows visible before the list scrolls
  BORDER_RADIUS_BUFFER — extra clearance at the bottom so the 12px border-radius is never
                         clipped by the window edge, keeping corners consistently rounded
*/
export const SEARCH_BAR_HEIGHT = 56; // 54px explicit height + 2px buffer for top border-radius
export const RESULTS_TOP_PAD = 7; // 1px border-top + 6px padding-top
export const RESULTS_BOTTOM_PAD = 6;
export const RESULT_ITEM_HEIGHT = 46; // 32px icon element (26px + 3px padding each side) + 12px item padding + 2px item margin
export const ACTION_BAR_HEIGHT = 31; // 30px height + 1px border-top
export const NO_RESULTS_HEIGHT = 80; // 32px padding-top + ~16px text + 32px padding-bottom
export const MAX_VISIBLE_ITEMS = 5;
export const BORDER_RADIUS_BUFFER = 2; // prevents bottom border-radius from being clipped by the window edge

/**
 * Calculates the required magnify window height based on the current result count
 * and whether a search has been performed.
 *
 * - No search yet:        search bar only
 * - Search, no results:   search bar + no-results row + action bar + buffer
 * - Search, 1–5 results:  search bar + results padding + (count × item height) + action bar + buffer
 * - Search, 6+ results:   capped at MAX_VISIBLE_ITEMS rows, list scrolls internally
 */
export function calculateWindowHeight(resultCount: number, hasSearched: boolean): number {
  if (!hasSearched) {
    return SEARCH_BAR_HEIGHT;
  }

  if (resultCount === 0) {
    return SEARCH_BAR_HEIGHT + NO_RESULTS_HEIGHT + ACTION_BAR_HEIGHT + BORDER_RADIUS_BUFFER;
  }

  const visibleItems = Math.min(resultCount, MAX_VISIBLE_ITEMS);
  return (
    SEARCH_BAR_HEIGHT +
    RESULTS_TOP_PAD +
    visibleItems * RESULT_ITEM_HEIGHT +
    RESULTS_BOTTOM_PAD +
    ACTION_BAR_HEIGHT +
    BORDER_RADIUS_BUFFER
  );
}
