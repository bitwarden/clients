type InitContextMenuItems = Omit<chrome.contextMenus.CreateProperties, "contexts"> & {
  requiresPremiumAccess?: boolean;
  requiresUnblockedUri?: boolean;
};

export { InitContextMenuItems };
