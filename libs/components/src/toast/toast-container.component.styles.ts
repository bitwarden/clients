import { tv } from "tailwind-variants";

export default tv({
  slots: {
    root: [
      "tw-fixed tw-grid tw-items-end tw-z-50 tw-pointer-events-none",
      "[bottom:var(--bit-toast-bottom)]",
      // Narrow screens: full-width, centred
      "tw-left-0 tw-right-0 tw-justify-items-center",
      // Wide screens: anchored to the inline-end
      "sm:tw-left-auto sm:[right:var(--bit-toast-end)] sm:tw-justify-items-end",
    ],
    // All items occupy the same grid cell so they stack on top of each other.
    // Only the last (top) item is visible; others are hidden via inline visibility style.
    item: "tw-row-start-1 tw-col-start-1",
  },
});
