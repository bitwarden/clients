import * as fs from "fs";
import * as path from "path";

import { PamInputError } from "@bitwarden/bit-common/pam/shared";
import { CliUtils } from "@bitwarden/cli/utils";

/** What the operator is told, on stderr, whenever a registration token is produced. */
export const TOKEN_ONE_TIME_WARNING =
  "Warning: this connector token is shown only once and cannot be recovered. " +
  "If it is lost, delete the connector and register a new one.";

/**
 * A token file claimed before the connector is registered, so a path that cannot be written is
 * found while nothing is at stake. The token is never held anywhere but the file or stdout.
 */
export class TokenFileReservation {
  private constructor(
    private fd: number,
    readonly filePath: string,
  ) {}

  /**
   * Creates `filePath` exclusively with mode 0600. It never overwrites a file.
   * @throws PamInputError when the file exists or cannot be created. The OS message is not echoed.
   */
  static reserve(filePath: string): TokenFileReservation {
    const resolved = path.resolve(filePath);
    let fd: number;
    try {
      fd = fs.openSync(resolved, "wx", 0o600);
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      throw new PamInputError(
        code === "EEXIST"
          ? "The token file already exists. Choose a path that does not exist; it is never overwritten."
          : "The token file could not be created. Check that its folder exists and is writable.",
      );
    }
    try {
      fs.fchmodSync(fd, 0o600);
    } catch {
      // Windows has no POSIX modes; the open mode is the best available there.
    }
    return new TokenFileReservation(fd, resolved);
  }

  /**
   * Writes the token and closes the file. Returns false when the write failed, after removing the
   * file: this class created it exclusively, so it is never a file that pre-existed, and leaving
   * it would make a retry with the same path fail as "already exists".
   */
  write(token: string): boolean {
    try {
      fs.writeSync(this.fd, token);
      return true;
    } catch {
      this.discard();
      return false;
    } finally {
      this.close();
    }
  }

  /** Closes and removes the file, for when registration failed and no token exists. */
  discard(): void {
    this.close();
    try {
      fs.unlinkSync(this.filePath);
    } catch {
      // Nothing more to do: the file is empty or partial, and holds no usable token.
    }
  }

  private close(): void {
    try {
      fs.closeSync(this.fd);
    } catch {
      // Already closed.
    }
  }
}

/** Prints the one-time warning to stderr unless the run is quiet. */
export function warnTokenIsOneTime(): void {
  if (process.env.BW_QUIET !== "true") {
    CliUtils.writeLn(TOKEN_ONE_TIME_WARNING, true, true);
  }
}
