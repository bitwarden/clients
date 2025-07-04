// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum DeviceType {
  Android = 0,
  iOS = 1,
  ChromeExtension = 2,
  FirefoxExtension = 3,
  OperaExtension = 4,
  EdgeExtension = 5,
  WindowsDesktop = 6,
  MacOsDesktop = 7,
  LinuxDesktop = 8,
  ChromeBrowser = 9,
  FirefoxBrowser = 10,
  OperaBrowser = 11,
  EdgeBrowser = 12,
  IEBrowser = 13,
  UnknownBrowser = 14,
  AndroidAmazon = 15,
  UWP = 16,
  SafariBrowser = 17,
  VivaldiBrowser = 18,
  VivaldiExtension = 19,
  SafariExtension = 20,
  SDK = 21,
  Server = 22,
  WindowsCLI = 23,
  MacOsCLI = 24,
  LinuxCLI = 25,
  DuckDuckGoBrowser = 26,
}

/**
 * Device type metadata
 * Each device type has a category corresponding to the client type and platform (Android, iOS, Chrome, Firefox, etc.)
 */
interface DeviceTypeMetadata {
  category: "mobile" | "extension" | "webApp" | "desktop" | "cli" | "sdk" | "server";
  platform: string;
}

export const DeviceTypeMetadata: Record<DeviceType, DeviceTypeMetadata> = {
  [DeviceType.Android]: { category: "mobile", platform: "Android" },
  [DeviceType.iOS]: { category: "mobile", platform: "iOS" },
  [DeviceType.AndroidAmazon]: { category: "mobile", platform: "Amazon" },
  [DeviceType.ChromeExtension]: { category: "extension", platform: "Chrome" },
  [DeviceType.FirefoxExtension]: { category: "extension", platform: "Firefox" },
  [DeviceType.OperaExtension]: { category: "extension", platform: "Opera" },
  [DeviceType.EdgeExtension]: { category: "extension", platform: "Edge" },
  [DeviceType.VivaldiExtension]: { category: "extension", platform: "Vivaldi" },
  [DeviceType.SafariExtension]: { category: "extension", platform: "Safari" },
  [DeviceType.ChromeBrowser]: { category: "webApp", platform: "Chrome" },
  [DeviceType.FirefoxBrowser]: { category: "webApp", platform: "Firefox" },
  [DeviceType.OperaBrowser]: { category: "webApp", platform: "Opera" },
  [DeviceType.EdgeBrowser]: { category: "webApp", platform: "Edge" },
  [DeviceType.IEBrowser]: { category: "webApp", platform: "IE" },
  [DeviceType.SafariBrowser]: { category: "webApp", platform: "Safari" },
  [DeviceType.VivaldiBrowser]: { category: "webApp", platform: "Vivaldi" },
  [DeviceType.DuckDuckGoBrowser]: { category: "webApp", platform: "DuckDuckGo" },
  [DeviceType.UnknownBrowser]: { category: "webApp", platform: "Unknown" },
  [DeviceType.WindowsDesktop]: { category: "desktop", platform: "Windows" },
  [DeviceType.MacOsDesktop]: { category: "desktop", platform: "macOS" },
  [DeviceType.LinuxDesktop]: { category: "desktop", platform: "Linux" },
  [DeviceType.UWP]: { category: "desktop", platform: "Windows UWP" },
  [DeviceType.WindowsCLI]: { category: "cli", platform: "Windows" },
  [DeviceType.MacOsCLI]: { category: "cli", platform: "macOS" },
  [DeviceType.LinuxCLI]: { category: "cli", platform: "Linux" },
  [DeviceType.SDK]: { category: "sdk", platform: "" },
  [DeviceType.Server]: { category: "server", platform: "" },
};
