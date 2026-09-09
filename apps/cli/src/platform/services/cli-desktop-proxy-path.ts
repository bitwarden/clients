import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export const DESKTOP_PROXY_PATH_ENV = "BITWARDEN_DESKTOP_PROXY_PATH";

const LINUX_FLATPAK_NATIVE_MESSAGING_PATHS = [
  "org.mozilla.firefox/.mozilla/native-messaging-hosts",
  "com.google.Chrome/config/google-chrome/NativeMessagingHosts",
  "org.chromium.Chromium/config/chromium/NativeMessagingHosts",
  "com.microsoft.Edge/config/microsoft-edge/NativeMessagingHosts",
];
const LINUX_NATIVE_MESSAGING_PATHS = [
  ".mozilla/native-messaging-hosts",
  ".config/google-chrome/NativeMessagingHosts",
  ".config/chromium/NativeMessagingHosts",
  ".config/microsoft-edge/NativeMessagingHosts",
  ".config/vivaldi/NativeMessagingHosts",
  ".config/BraveSoftware/Brave-Browser/NativeMessagingHosts",
  ".config/net.imput.helium/NativeMessagingHosts",
];

/** Returns well-known locations for the desktop native-messaging proxy. */
export function getDesktopProxyPaths(
  platform = os.platform(),
  homeDir = os.homedir(),
  environment: NodeJS.ProcessEnv = process.env,
): string[] {
  if (platform === "win32") {
    return [
      environment.LOCALAPPDATA &&
        path.win32.join(environment.LOCALAPPDATA, "Programs", "Bitwarden", "desktop_proxy.exe"),
      environment.ProgramFiles &&
        path.win32.join(environment.ProgramFiles, "Bitwarden", "desktop_proxy.exe"),
      environment["ProgramFiles(x86)"] &&
        path.win32.join(environment["ProgramFiles(x86)"], "Bitwarden", "desktop_proxy.exe"),
    ].filter((candidate): candidate is string => candidate != null);
  }

  if (platform === "darwin") {
    return [
      "/Applications/Bitwarden.app/Contents/MacOS/desktop_proxy",
      path.posix.join(homeDir, "Applications/Bitwarden.app/Contents/MacOS/desktop_proxy"),
    ];
  }

  const nativeMessagingProxy = ".bitwarden_desktop_proxy";
  return [
    // Prefer stable Desktop installation paths. Desktop also hard-links or copies
    // its proxy into browser native-messaging directories on Linux; those
    // host-visible copies are useful fallbacks for sandboxed or portable installs.
    "/opt/Bitwarden/desktop_proxy",
    "/usr/lib/bitwarden/desktop_proxy",
    "/usr/lib/bitwarden-desktop/desktop_proxy",
    "/snap/bitwarden/current/desktop_proxy",
    ...LINUX_NATIVE_MESSAGING_PATHS.map((nativePath) =>
      path.posix.join(homeDir, nativePath, nativeMessagingProxy),
    ),
    ...LINUX_FLATPAK_NATIVE_MESSAGING_PATHS.map((nativePath) =>
      path.posix.join(homeDir, ".var/app", nativePath, nativeMessagingProxy),
    ),
  ];
}

/** Resolves an explicit override or the first installed desktop proxy. */
export function resolveDesktopProxyPath(
  proxyPaths = getDesktopProxyPaths(),
  override = process.env[DESKTOP_PROXY_PATH_ENV],
  exists: (candidate: string) => boolean = fs.existsSync,
): string {
  if (override != null && override !== "") {
    if (!exists(override)) {
      throw new Error(
        `${DESKTOP_PROXY_PATH_ENV} points to a file that does not exist: ${override}`,
      );
    }
    return override;
  }

  const proxyPath = proxyPaths.find(exists);
  if (proxyPath == null) {
    throw new Error(
      `Could not find the Bitwarden Desktop proxy. Set ${DESKTOP_PROXY_PATH_ENV} to its path.`,
    );
  }
  return proxyPath;
}
