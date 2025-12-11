import { SystemService } from "@bitwarden/common/platform/abstractions/system.service";

/**
 * CLI implementation of SystemService.
 * The implementation is NOOP since these functions are meant for GUI clients.
 */
export class CliSystemService extends SystemService {
  async clearClipboard(clipboardValue: string, timeoutMs?: number): Promise<void> {}
  async clearPendingClipboard(): Promise<any> {}
}
