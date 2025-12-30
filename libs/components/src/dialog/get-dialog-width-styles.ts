export type DialogSize = "small" | "default" | "large";

const dialogSizeToWidthMap = new Map<DialogSize, string>([
  ["small", "md:tw-max-w-sm"],
  ["default", "md:tw-max-w-xl"],
  ["large", "md:tw-max-w-3xl"],
]);

/**
 * Get the dialog width styles based on the dialog size.
 */
export const getDialogWidthStyles = (size: DialogSize = "default") =>
  dialogSizeToWidthMap.get(size);
