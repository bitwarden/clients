import { SystemService } from "@bitwarden/common/platform/abstractions/system.service";

/**
 * Web implementation of SystemService.
 * The implementation is NOOP since these functions are not supported on web.
 */
export class WebSystemService extends SystemService {
  async clearClipboard(clipboardValue: string, timeoutMs?: number): Promise<void> {}
  async clearPendingClipboard(): Promise<any> {}
}
