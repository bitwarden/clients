import { ipcRenderer } from "electron";

export type RendererMenuItem = {
  label?: string;
  type?: "normal" | "separator" | "submenu" | "checkbox" | "radio";
  click?: () => any;
};

export function invokeMenu(menu: RendererMenuItem[]) {
  const menuWithoutClick = menu.map((m) => {
    return { label: m.label, type: m.type };
  });
  ipcRenderer.invoke("openContextMenu", { menu: menuWithoutClick }).then((i: number) => {
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

export function isAppImage() {
  return process.platform === "linux" && "APPIMAGE" in process.env;
}

export function isMac() {
  return process.platform === "darwin";
}

export function isMacAppStore() {
  return isMac() && process.mas === true;
}

export function isWindowsStore() {
  const isWindows = process.platform === "win32";
  let windowsStore = process.windowsStore;
  if (
    isWindows &&
    !windowsStore &&
    process.resourcesPath.indexOf("8bitSolutionsLLC.bitwardendesktop_") > -1
  ) {
    windowsStore = true;
  }
  return isWindows && windowsStore === true;
}

export function isSnapStore() {
  return process.platform === "linux" && process.env.SNAP_USER_DATA != null;
}

export function isFlatpak() {
  return process.platform === "linux" && process.env.container != null;
}

export function isWindowsPortable() {
  return process.platform === "win32" && process.env.PORTABLE_EXECUTABLE_DIR != null;
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

export async function getCookie(url: string, name: string): Promise<Electron.Cookie[]> {
  return await ipcRenderer.invoke("getCookie", { url: url, name: name });
}
