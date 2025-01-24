type InitContextMenuItems = Omit<chrome.contextMenus.CreateProperties, "contexts"> & {
  checkPremiumAccess?: boolean;
  checkUriIsBlocked?: boolean;
};

export { InitContextMenuItems };
