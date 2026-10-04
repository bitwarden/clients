import { catchError, filter, firstValueFrom, map, merge, of, timeout } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { SharedUnlockPeerService } from "@bitwarden/common/key-management/shared-unlock";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { UnlockMethod, UnlockService } from "@bitwarden/unlock";

import { CliIpcService } from "../platform/services/cli-ipc.service";

/**
 * How long to wait for the desktop app to hand over the unlock state before giving up on it.
 */
export const REMOTE_UNLOCK_TIMEOUT_MS = 2_000;

/**
 * The shared unlock protocol allows the CLI to unlock via the desktop app
 *   desktop unlocked  ->  the CLI unlocks with no prompt, even with no BW_SESSION exported
 *   CLI unlocks       ->  the desktop unlocks, and relays onward to the browser extension
 *   CLI locks         ->  likewise
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
   * Starts the shared unlock protocol
   */
  async start(): Promise<boolean> {
    this.startup ??= this.startPeer();
    return await this.startup;
  }

  /**
   * Waits for the desktop app to push over an unlocked state for the user.
   *
   * The desktop app *should* immediately reply without delay
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
      .pipe(filter((lockState) => lockState === "Locked"))
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
