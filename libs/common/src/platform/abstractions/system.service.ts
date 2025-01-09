export abstract class SystemService {
  abstract clearClipboard(clipboardValue: string, timeoutMs?: number): Promise<void>;
  abstract clearPendingClipboard(): Promise<any>;
}
