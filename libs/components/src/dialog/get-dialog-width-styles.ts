export type DialogSize = "small" | "default" | "large";

const dialogSizeToWidthMap = new Map<DialogSize, string>([
  ["small", "md:tw-max-w-sm"],
  ["default", "md:tw-max-w-xl"],
  ["large", "md:tw-max-w-3xl"],
]);

const drawerSizeToWidthMap = new Map<DialogSize, string>([
  ["small", "md:tw-max-w-sm"],
  ["default", "md:tw-max-w-lg"],
  ["large", "md:tw-max-w-2xl"],
]);

export const getDialogWidthStyles = (size: DialogSize = "default", isDrawer: boolean = false) =>
  isDrawer ? drawerSizeToWidthMap.get(size) : dialogSizeToWidthMap.get(size);
