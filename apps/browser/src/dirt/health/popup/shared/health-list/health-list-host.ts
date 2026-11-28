/**
 * Host classes for a component wrapping a Health list's `bit-table-v2 height="fill"`, copied from
 * the popup vault list. They pass height through to the table so it can fill the page's scroll
 * area, and the negative margins cancel `popup-page`'s padding so the toolbar border reaches the
 * popup edges. Put the component inside `<div class="tw-flex tw-flex-col tw-h-full">`.
 */
export const HEALTH_LIST_HOST_CLASS =
  "tw-flex tw-flex-col tw-flex-1 tw-min-h-0 -tw-mx-3 -tw-mt-3 -tw-mb-2.5 bit-compact:-tw-mx-2 bit-compact:-tw-mt-2 bit-compact:-tw-mb-1.5";
