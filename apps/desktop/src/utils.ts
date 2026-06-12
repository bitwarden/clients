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
  return BIT_ENVIRONMENT === "development";
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
