const VaultMessages = {
  HasBwInstalled: "hasBwInstalled",
  checkBwInstalled: "checkIfBWExtensionInstalled",
  /** @deprecated use {@link OpenBrowserExtensionToUrl} */
  OpenAtRiskPasswords: "openAtRiskPasswords",
  OpenBrowserExtensionToUrl: "openBrowserExtensionToUrl",
  PopupOpened: "popupOpened",
} as const;

export { VaultMessages };
