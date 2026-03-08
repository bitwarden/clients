import { tv } from "tailwind-variants";

export default tv({
  slots: {
    root: "tw-fixed tw-flex tw-flex-col tw-gap-1 tw-z-50 tw-pointer-events-none",
    item: "tw-pointer-events-auto",
  },
  variants: {
    position: {
      "bottom-right": { root: "tw-bottom-4 tw-right-4 tw-items-end" },
      "bottom-full-width": { root: "tw-bottom-4 tw-left-0 tw-right-0 tw-items-center" },
      "top-full-width": { root: "tw-left-0 tw-right-0 tw-items-center" },
    },
  },
});
