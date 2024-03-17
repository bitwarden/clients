type InitContextMenuItems = Omit<chrome.contextMenus.CreateProperties, "contexts"> & {
  checkPremiumAccess?: boolean;
};

export { InitContextMenuItems };
