/**
 * We block the browser integration on some unsupported platforms prevents
 * experimenting with the feature for QA. So this env var allows overriding
 * the block.
 */
export function allowBrowserintegrationOverride() {
  return process.env.ALLOW_BROWSER_INTEGRATION_OVERRIDE === "true";
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
