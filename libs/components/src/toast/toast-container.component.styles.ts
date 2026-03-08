import { tv } from "tailwind-variants";

export default tv({
  slots: {
    root: [
      "tw-fixed tw-flex tw-flex-col tw-gap-1 tw-z-50 tw-pointer-events-none",
      "[bottom:var(--bit-toast-bottom)]",
      // Narrow screens: full-width, centred
      "tw-left-0 tw-right-0 tw-items-center",
      // Wide screens: anchored to the inline-end
      "sm:tw-left-auto sm:[right:var(--bit-toast-end)] sm:tw-items-end",
    ],
    item: "tw-pointer-events-auto",
  },
});
