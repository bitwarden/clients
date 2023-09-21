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
}

export const MobileDeviceTypes: Set<DeviceType> = new Set([
  DeviceType.Android,
  DeviceType.iOS,
  DeviceType.AndroidAmazon,
]);

export const DesktopDeviceTypes: Set<DeviceType> = new Set([
  DeviceType.WindowsDesktop,
  DeviceType.MacOsDesktop,
  DeviceType.LinuxDesktop,
  DeviceType.UWP,
]);
