import { catchError, filter, firstValueFrom, map, merge, of, timeout } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import {
  PeerLockState,
  SharedUnlockPeerService,
} from "@bitwarden/common/key-management/shared-unlock";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { UnlockMethod, UnlockService } from "@bitwarden/unlock";

import { CliIpcService } from "../platform/services/cli-ipc.service";

/**
 * How long to wait for the desktop app to hand over the unlock state before giving up on it.
 *
 * The peer announces itself as part of starting, so this only covers a single desktop hop — well
 * short of the protocol's 5s sync interval.
 */
export const REMOTE_UNLOCK_TIMEOUT_MS = 15_000;

/**
 * The CLI's participation in the shared unlock protocol, which lets it borrow the desktop app's
 * unlock state instead of maintaining its own:
 *
 *   desktop unlocked  ->  the CLI unlocks with no prompt, even with no BW_SESSION exported
 *   CLI unlocks       ->  the desktop unlocks, and relays onward to the browser extension
 *   CLI locks         ->  likewise
 *
 * Owns the peer's lifetime, which matters more here than on other clients: the peer's sync timer
 * keeps the Node event loop alive, so a CLI process that does not {@link abort} never exits.
 */
export class CliSharedUnlockService {
  private startup?: Promise<boolean>;
  private abortController?: AbortController;

  constructor(
    private configService: ConfigService,
    private ipcService: CliIpcService,
    private peerService: SharedUnlockPeerService,
    private unlockService: UnlockService,
    private logService: LogService,
  ) {}

  /**
   * Starts this device's peer, best-effort. Idempotent.
   *
   * Callers must have established the desktop connection first: a failed verification is not
   * cached, so probing it again here would pay the discover timeout a second time.
   *
   * @returns whether a peer is running. The desktop app is optional, so a `false` here is a
   * normal outcome that callers fall back from rather than an error.
   */
  async start(): Promise<boolean> {
    this.startup ??= this.startPeer();
    return await this.startup;
  }

  /**
   * Waits for the desktop app to push over an unlocked state for the user.
   *
   * Settles as soon as the desktop reports the user locked, which it does within milliseconds of
   * this peer announcing itself. The timeout is then only reached when the desktop does not answer
   * at all, rather than on every command run against a locked desktop.
   *
   * @returns whether the vault was unlocked by a peer within {@link REMOTE_UNLOCK_TIMEOUT_MS}.
   */
  async waitForRemoteUnlock(userId: UserId): Promise<boolean> {
    const unlocked$ = this.unlockService.unlocked$.pipe(
      filter((event) => event.userId === userId && event.method === UnlockMethod.SharedUnlock),
      map(() => true),
    );

    const reportedLocked$ = this.peerService
      .peerState$(userId)
      .pipe(filter((lockState) => lockState === PeerLockState.Locked))
      .pipe(map(() => false));

    return await firstValueFrom(
      merge(unlocked$, reportedLocked$).pipe(
        timeout({ first: REMOTE_UNLOCK_TIMEOUT_MS }),
        catchError(() => of(false)),
      ),
    );
  }

  /**
   * Cancels the peer, releasing the timer that would otherwise hold the process open.
   *
   * Synchronous, so it can run from an exit handler. Prefer {@link stop} where there is still a
   * chance to flush.
   */
  abort(): void {
    this.abortController?.abort();
    this.abortController = undefined;
    this.startup = undefined;
  }

  /** Cancels the peer and waits for anything it just sent to reach the desktop app. */
  async stop(): Promise<void> {
    this.abort();
    await this.ipcService.drainAndDisconnect();
  }

  private async startPeer(): Promise<boolean> {
    try {
      if (!(await this.configService.getFeatureFlag(FeatureFlag.SharedUnlockPart2))) {
        return false;
      }

      this.abortController = new AbortController();
      await this.peerService.start(this.abortController);
      return true;
    } catch (error) {
      this.logService.info("[SharedUnlock] Could not start the CLI shared unlock peer", error);
      this.abortController = undefined;
      return false;
    }
  }
}
