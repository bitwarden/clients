import { tv } from "tailwind-variants";

export default tv({
  slots: {
    root: "tw-w-[25rem] tw-rounded-xl tw-border tw-border-solid tw-overflow-hidden tw-shadow-lg tw-pointer-events-auto tw-cursor-default",
    body: "tw-flex tw-items-center tw-gap-3 tw-p-4",
    icon: "tw-text-2xl tw-shrink-0",
    closeButton: "tw-ms-auto tw-shrink-0",
    title: "tw-font-semibold tw-mb-0",
    message: "tw-mb-2 last:tw-mb-0",
  },
  variants: {
    variant: {
      success: {
        root: "tw-bg-bg-success-medium tw-border-border-success-soft",
        icon: "tw-text-fg-success-strong",
        title: "tw-text-fg-success-strong",
        message: "tw-text-fg-success-strong",
      },
      error: {
        root: "tw-bg-bg-danger-medium tw-border-border-danger-soft",
        icon: "tw-text-fg-danger-strong",
        title: "tw-text-fg-danger-strong",
        message: "tw-text-fg-danger-strong",
      },
      info: {
        root: "tw-bg-bg-brand-soft tw-border-border-brand-soft",
        icon: "tw-text-fg-brand-strong",
        title: "tw-text-fg-brand-strong",
        message: "tw-text-fg-brand-strong",
      },
      warning: {
        root: "tw-bg-bg-warning-medium tw-border-border-warning-soft",
        icon: "tw-text-fg-warning-strong",
        title: "tw-text-fg-warning-strong",
        message: "tw-text-fg-warning-strong",
      },
    },
  },
});
