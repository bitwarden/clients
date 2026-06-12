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
