import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { SharedUnlockPeerService } from "@bitwarden/common/key-management/shared-unlock";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

/**
 * The shared unlock service for the CLI. A command is ephemeral, so this always spawns a new
 * connection.
 */
export class CliSharedUnlockService {
  private started: Promise<boolean> | null = null;

  constructor(
    private sharedUnlockPeerService: SharedUnlockPeerService,
    private configService: ConfigService,
    private logService: LogService,
  ) {}

  /** Whether a peer is running, after starting one if this invocation has not yet. */
  start(): Promise<boolean> {
    this.started ??= this.startPeer();
    return this.started;
  }

  private async startPeer(): Promise<boolean> {
    if (!(await this.configService.getFeatureFlag(FeatureFlag.SharedUnlockPart2))) {
      return false;
    }

    try {
      await this.sharedUnlockPeerService.start();
      return true;
    } catch (error) {
      this.logService.info("Could not start the CLI shared unlock peer", error);
      return false;
    }
  }
}
