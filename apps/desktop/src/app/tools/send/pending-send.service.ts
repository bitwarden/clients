import { Injectable } from "@angular/core";

/**
 * Holds file/directory paths received from the Windows Explorer context menu
 * ("Create Send") that have not yet been handed to the Send creation dialog.
 *
 * Used by the pending-send route guard to redirect from `/vault` to `/send`
 * after the vault is unlocked.
 */
@Injectable({ providedIn: "root" })
export class PendingSendService {
  private paths: string[] = [];

  /** Add paths for deferred processing. Accumulates across multiple calls. */
  addPaths(paths: string[]): void {
    this.paths.push(...paths);
  }

  /** Consume and return any pending paths, clearing them from the service. */
  takePaths(): string[] {
    const result = this.paths;
    this.paths = [];
    return result;
  }

  /** Whether there are pending paths waiting to be processed. */
  hasPending(): boolean {
    return this.paths.length > 0;
  }
}
