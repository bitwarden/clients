/**
 * Debug-log sink for performance data. Kept as a plain callback so this package stays independent of
 * `@bitwarden/logging` — `ConsoleLogService` delegates into this package, and depending back on it
 * would be circular.
 */
export type PerformanceLogSink = (message?: any, ...optionalParams: any[]) => void;
