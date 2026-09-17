import { app } from "electron";

/**
 * Command-line flag marking a launch performed by the OS at login.
 *
 * Any auto-start mechanism that can pass arguments must provide it.
 */
export const AUTOSTART_FLAG = "--autostart";

/**
 * Was this process launched by the OS at login, rather than by the user?
 *
 * Linux passes {@link AUTOSTART_FLAG} through the `.desktop` file or the
 * Flatpak portal command, and Windows through the login-item `args`. macOS
 * drops login-item arguments entirely, so there we ask the OS directly.
 *
 * Must only be called once the app is ready: macOS captures the answer while
 * handling the launch event that emits `ready`, and reports a launch by the
 * user until then.
 */
export function isAutostartLaunch(): boolean {
  if (process.argv.includes(AUTOSTART_FLAG)) {
    return true;
  }

  return process.platform === "darwin" && app.getLoginItemSettings().wasOpenedAtLogin;
}
