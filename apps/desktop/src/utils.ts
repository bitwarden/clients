// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
export type RendererMenuItem = {
  label?: string;
  type?: "normal" | "separator" | "submenu" | "checkbox" | "radio";
  click?: () => any;
};

export function invokeMenu(menu: RendererMenuItem[]) {
  const menuWithoutClick = menu.map((m) => {
    return { label: m.label, type: m.type };
  });
  // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  ipc.platform.openContextMenu(menuWithoutClick).then((i: number) => {
    if (i !== -1) {
      menu[i].click();
    }
  });
}

export function isDev() {
  // ref: https://github.com/sindresorhus/electron-is-dev
  if ("ELECTRON_IS_DEV" in process.env) {
    return parseInt(process.env.ELECTRON_IS_DEV, 10) === 1;
  }
  return process.defaultApp || /node_modules[\\/]electron[\\/]/.test(process.execPath);
}

export function isLinux() {
  return process.platform === "linux";
}

export function isAppImage() {
  return isLinux() && "APPIMAGE" in process.env;
}

export function isSnapStore() {
  return isLinux() && process.env.SNAP_USER_DATA != null;
}

export function isMac() {
  return process.platform === "darwin";
}

export function isMacAppStore() {
  return isMac() && process.mas === true;
}

export function isWindows() {
  return process.platform === "win32";
}

export function isWindowsStore() {
  const windows = isWindows();
  let windowsStore = process.windowsStore;
  if (
    windows &&
    !windowsStore &&
    process.resourcesPath?.indexOf("8bitSolutionsLLC.bitwardendesktop_") > -1
  ) {
    windowsStore = true;
  }
  return windows && windowsStore === true;
}

export function isFlatpak() {
  return process.platform === "linux" && process.env.container != null;
}

export function isWindowsPortable() {
  return isWindows() && process.env.PORTABLE_EXECUTABLE_DIR != null;
}

/**
 * We block the browser integration on some unsupported platforms, which also
 * blocks partially supported platforms (mac .dmg in dev builds) / prevents
 * experimenting with the feature for QA. So this env var allows overriding
 * the block.
 */
export function allowBrowserintegrationOverride() {
  return process.env.ALLOW_BROWSER_INTEGRATION_OVERRIDE === "true";
}

/**
 * Sanitize user agent so external resources used by the app can't built data on our users.
 */
export function cleanUserAgent(userAgent: string): string {
  const userAgentItem = (startString: string, endString: string) => {
    const startIndex = userAgent.indexOf(startString);
    return userAgent.substring(startIndex, userAgent.indexOf(endString, startIndex) + 1);
  };
  const systemInformation = "(Windows NT 10.0; Win64; x64)";

  // Set system information, remove bitwarden, and electron information
  return userAgent
    .replace(userAgentItem("(", ")"), systemInformation)
    .replace(userAgentItem("Bitwarden", " "), "")
    .replace(userAgentItem("Electron", " "), "");
}
