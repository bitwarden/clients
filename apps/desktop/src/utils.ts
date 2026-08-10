// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
export function isDev() {
  return BIT_ENVIRONMENT === "development";
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
    (process.resourcesPath?.indexOf("8bitSolutionsLLC.bitwardendesktop_") > -1 ||
      process.resourcesPath?.indexOf("8bitSolutionsLLC.BitwardenBeta_") > -1)
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
 * Overrides the access token location
 */
export const EnvAccessTokenLocation = Object.freeze({
  Disk: "DISK",
  Default: "DEFAULT",
} as const);
export type EnvAccessTokenLocation =
  (typeof EnvAccessTokenLocation)[keyof typeof EnvAccessTokenLocation];

/**
 * Reads the `ACCESS_TOKEN_LOCATION` env var. `DISK` forces the access token to be stored
 * unencrypted on disk (bypassing the OS keyring); anything else (including unset) keeps the
 * default keyring-backed secure storage.
 *
 * This is useful on systems where the keyring is unreliable (KDE/Kwallet) where the user
 * otherwise experiences periodic logouts.
 */
export function accessTokenLocation(): EnvAccessTokenLocation {
  return process.env.ACCESS_TOKEN_LOCATION?.toUpperCase() === EnvAccessTokenLocation.Disk
    ? EnvAccessTokenLocation.Disk
    : EnvAccessTokenLocation.Default;
}

/**
 * We block the browser integration on some unsupported platforms prevents
 * experimenting with the feature for QA. So this env var allows overriding
 * the block.
 */
export function allowBrowserintegrationOverride() {
  return process.env.ALLOW_BROWSER_INTEGRATION_OVERRIDE === "true";
}

/**
 * Reads the `EXPERIMENTAL_CLOSE_RENDERER` env var. When set to `true`, the browser window is
 * destroyed whenever the app is hidden to the tray, killing the renderer process and releasing its
 * memory. The window is recreated when the app is brought back to the foreground. Merely
 * minimizing the window does not tear it down; it stays in the taskbar and restores instantly.
 *
 * This is experimental: anything that depends on a live renderer while the app is in the
 * background (in-memory session state, IPC pushed from main, native messaging) does not survive
 * the teardown. These will be ported before this can be default enabled.
 */
export function experimentalCloseRenderer(): boolean {
  return process.env.EXPERIMENTAL_CLOSE_RENDERER === "true";
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

/**
 * Returns `true` if the provided string is not undefined, not null, and not empty.
 * Otherwise, returns `false`.
 */
export function stringIsNotUndefinedNullAndEmpty(str: string): boolean {
  return str?.length > 0;
}
