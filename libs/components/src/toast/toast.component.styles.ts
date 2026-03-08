import { tv } from "tailwind-variants";

export default tv({
  slots: {
    root: "tw-mb-1 tw-min-w-[19rem] tw-text-main tw-flex tw-flex-col tw-justify-between tw-rounded-md tw-pointer-events-auto tw-cursor-default tw-overflow-hidden tw-shadow-lg",
    body: "tw-flex tw-items-center tw-gap-4 tw-px-2 tw-pb-1 tw-pt-2",
    icon: "bwi tw-text-xl tw-py-1.5 tw-px-2.5",
    title: "tw-font-medium tw-mb-0",
    message: "tw-mb-2 last:tw-mb-0",
    closeButton: "tw-ms-auto hover:tw-border-text-main focus-visible:before:tw-ring-text-main",
  },
  variants: {
    variant: {
      success: { root: "tw-bg-success-100", icon: "bwi-check-circle" },
      error: { root: "tw-bg-danger-100", icon: "bwi-error" },
      info: { root: "tw-bg-info-100", icon: "bwi-info-circle" },
      warning: { root: "tw-bg-warning-100", icon: "bwi-exclamation-triangle" },
    },
  },
});
