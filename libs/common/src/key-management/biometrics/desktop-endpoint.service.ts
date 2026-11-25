import { Endpoint, ipcRequestGetBiometricsStatus } from "@bitwarden/sdk-internal";

import { LogService } from "../../platform/abstractions/log.service";
import { IpcService } from "../../platform/ipc";
import { UserId } from "../../types/guid";
import { fromTsUserId } from "../utils";

/** The desktop's two processes, in the order a tie is broken. */
const CANDIDATES: Endpoint[] = ["DesktopMain", "DesktopRenderer"];

/** Long enough for a busy desktop to answer, short enough not to stall an unlock. */
const PROBE_TIMEOUT_MS = 5_000;

/**
 * Which of the desktop's two processes serves biometrics and shared unlock.
 *
 * The desktop serves them from main or from its renderer depending on how it is configured, and
 * only the one that does will answer. Both are asked for a biometrics status at the same time,
 * and whichever answers is used for every later biometrics and shared unlock request.
 *
 * The answer is kept until {@link forget}, because it only changes when the desktop restarts,
 * which drops the connection.
 */
export class DesktopEndpointService {
  private resolving?: Promise<Endpoint | undefined>;
  private resolved?: Endpoint;

  constructor(
    private readonly ipcService: IpcService,
    private readonly logService: LogService,
  ) {}

  /** The endpoint to address, or undefined when no desktop answered. */
  async endpoint(userId: UserId): Promise<Endpoint | undefined> {
    this.resolving ??= this.probe(userId);

    return await this.resolving;
  }

  /** The endpoint already found, without asking. Undefined until {@link endpoint} has resolved. */
  get current(): Endpoint | undefined {
    return this.resolved;
  }

  /** Drops what was found, so the next request asks again. Call when the connection is lost. */
  forget(): void {
    this.resolving = undefined;
    this.resolved = undefined;
  }

  private async probe(userId: UserId): Promise<Endpoint | undefined> {
    const sdkUserId = fromTsUserId(userId);
    const answers = await Promise.allSettled(
      CANDIDATES.map(async (candidate) => {
        await ipcRequestGetBiometricsStatus(
          this.ipcService.client,
          sdkUserId,
          candidate,
          AbortSignal.timeout(PROBE_TIMEOUT_MS),
        );
        return candidate;
      }),
    );

    // Asked together rather than one after the other: the process that is not serving answers
    // nothing, so asking in turn would wait out a timeout before trying the other.
    const answered = answers.find((answer) => answer.status === "fulfilled");
    if (answered == null) {
      this.logService.info("[Desktop IPC] Neither desktop process answered a biometrics status");
      this.resolving = undefined;
      return undefined;
    }

    this.resolved = answered.value;
    this.logService.info(`[Desktop IPC] Biometrics are served by ${this.resolved}`);

    return this.resolved;
  }
}
