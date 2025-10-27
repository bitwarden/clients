import { Utils } from "./utils";

const CanLaunchWhitelist = [
  "https://",
  "http://",
  "ssh://",
  "ftp://",
  "sftp://",
  "irc://",
  "vnc://",
  // https://docs.microsoft.com/en-us/windows-server/remote/remote-desktop-services/clients/remote-desktop-uri
  "rdp://", // Legacy RDP URI scheme
  "ms-rd:", // Preferred RDP URI scheme
  "chrome://",
  "iosapp://",
  "androidapp://",
];

export class SafeUrls {
  static canLaunch(uri: string | null | undefined): boolean {
    if (Utils.isNullOrWhitespace(uri)) {
      return false;
    }

    for (let i = 0; i < CanLaunchWhitelist.length; i++) {
      if (uri!.indexOf(CanLaunchWhitelist[i]) === 0) {
        return true;
      }
    }

    return false;
  }
}
