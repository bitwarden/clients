import { LogLevel } from "./log-level";

/**
 * A framework-agnostic sink that receives every log event teed from
 * {@link ConsoleLogService.write}. Implementations forward events to an external
 * store (e.g. the SDK Flight Recorder buffer) without changing the `LogService`
 * public API.
 */
export interface LogRecorder {
  /**
   * Records a single log event. Fire-and-forget: this must never throw and must
   * not log via `LogService` (doing so risks a feedback loop). Callers guard the
   * call regardless, so a throwing implementation drops events rather than
   * breaking the log call.
   */
  record(level: LogLevel, message?: any, ...optionalParams: any[]): void;

  /**
   * Decides whether to record. Events from before the first call are held until it
   * arrives, so a recorder that is never told records nothing. The first call wins.
   */
  setEnabled(enabled: boolean): void;
}
