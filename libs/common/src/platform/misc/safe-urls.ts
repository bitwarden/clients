import { Utils } from "./utils";

export const UrlType = Object.freeze({
  /** URI schemes stored in vault cipher items */
  CipherUri: [
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
  ],
  /** URI schemes for web pages opened in an external browser */
  WebUrl: ["https://"],
} as const);
export type UrlType = (typeof UrlType)[keyof typeof UrlType];

export class SafeUrls {
  static canLaunch(uri: string | null | undefined, type: UrlType): boolean {
    if (Utils.isNullOrWhitespace(uri)) {
      return false;
    }

    for (let i = 0; i < type.length; i++) {
      if (uri!.indexOf(type[i]) === 0) {
        return true;
      }
    }

    return false;
  }
}
