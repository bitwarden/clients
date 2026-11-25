import { DesktopAutotypePairingUri } from "@bitwarden/common/desktop-native/models/desktop-autotype-pairing-uri";

/**
 * Service to list the desktop apps a login can be paired with for Autotype. Only the desktop
 * client provides it.
 */
export abstract class AppPairingService {
  /**
   * Lists the apps that are running, as Desktop Autotype Pairing URIs sorted by app name.
   *
   * Returns `null` if the apps couldn't be listed, for example because the request failed, timed
   * out or was aborted through `signal`.
   *
   * The pairing URIs hold the apps' names and paths, so they must never be logged.
   */
  abstract getRunningApps(signal: AbortSignal): Promise<DesktopAutotypePairingUri[] | null>;
}
