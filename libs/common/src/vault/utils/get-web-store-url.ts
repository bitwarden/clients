import { DeviceType } from "@bitwarden/common/enums";

/**
 *  Returns the web store URL for the Bitwarden browser extension based on the device type.
 *  @defaults Bitwarden download page
 */
export const getWebStoreUrl = (deviceType: DeviceType): string => {
  switch (deviceType) {
    case DeviceType.ChromeBrowser:
      return "https://chromewebstore.google.com/detail/bitwarden-password-manage/nngceckbapebfimnlniiiahkandclblb";
    case DeviceType.FirefoxBrowser:
      return "https://addons.mozilla.org/en-US/firefox/addon/bitwarden-password-manager/";
    case DeviceType.SafariBrowser:
      return "https://apps.apple.com/us/app/bitwarden/id1352778147?mt=12";
    case DeviceType.OperaBrowser:
      return "https://addons.opera.com/extensions/details/bitwarden-free-password-manager/";
    case DeviceType.EdgeBrowser:
      return "https://microsoftedge.microsoft.com/addons/detail/jbkfoedolllekgbhcbcoahefnbanhhlh";
    default:
      return "https://bitwarden.com/download/#downloads-web-browser";
  }
};
